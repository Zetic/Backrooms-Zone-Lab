#include "ZoneLabBuild.h"
#include <algorithm>
#include <climits>
#include <set>

// The house (ZoneLabVersion 2). A house is grown along a spine: the entry, then the rooms everyone shares, then
// halls with the private rooms off them. It is decided in the order an architect works: what rooms the house
// has (MakeProgram), how they are arranged about the spine (Compact or Spread), where each opening goes (Plan
// links), and then whether the result keeps the house rules (Rules). Two dials move it away from an ordinary
// house, each loosening named rules in a fixed order:
//   Sprawl, compact to sprawling. Below 55 the house is a box on two storeys: a centre hall with the stair
//      beside it, the rooms everyone shares on the ground floor (either all on one side of the hall, or the
//      living and dining rooms either side of the entry), bedrooms upstairs; the box widens and lengthens
//      as the dial rises. From 30 a one-storey wing grows
//      from the back of the hall and takes a den; from 40 it takes the main bedroom; from 48 it turns. From 55
//      the house is one storey: through the entry into the living room, through that into the dining room with
//      the kitchen beside it, then down halls that turn, with the bedrooms and bathrooms off them; more halls,
//      and more of them with rooms on one side only, the further the dial goes.
//   Strangeness, expected to wrong. From 20 rooms stray from their proportions; from 30 halls widen and run on
//      past their rooms; from 40 halls branch, and an odd wing grows from even a compact house; from 50 rooms
//      repeat; from 55 branches may lead nowhere; from 70 rooms turn up in the wrong places; from 85 bedrooms
//      open through bedrooms and ceilings change height from room to room.
// Every random choice is a named draw of the attempt's stream. With both dials at 0 every rule is kept on every
// seed (Tools/ZoneLabCheck.cpp holds the template to that); an attempt that breaks a rule the dials do not
// relax is given up and the next one tried.
namespace ZoneLab::Build
{
namespace
{
using Templates::Stream;
// (A storey is its ceiling and the two slabs' clearance Generate asks of stacked rooms: 250 + 20 + 20. The stair
// is a ramp for now: 2 m of landing, 5 m of slope, 2 m of landing.)
constexpr int StoreyRise=290,Ceiling=250,StairRun=10,StairLong=StairRun+4,Attempts=16,SprawlOneStorey=55;
// The residential theme's room roles (TemplateRecipes.cpp), which give a room its finishes.
enum ThemeRole { PlainFinish=0,LivingFinish=1,BedroomFinish=2,ClosetFinish=3,BathFinish=4,KitchenFinish=5,StorageFinish=6 };
// What each role is called, how it is built, and the least size and the most elongated shape it may have
// (narrow side, units; long side over narrow side) while the proportions rule holds.
struct RoleInfo { const char* role;const char* title;const char* kind;int finish;int least;double aspect; };
const RoleInfo RoleTable[]={
    {"entry","Entry hall","hall",PlainFinish,3,99},{"hall","Hallway","hall",PlainFinish,3,99},{"backhall","Back hall","hall",PlainFinish,3,99},
    {"landing","Landing","hall",PlainFinish,3,99},{"uphall","Upstairs hall","hall",PlainFinish,3,99},{"stair","Stairs","stair",PlainFinish,3,99},
    {"living","Living room","room",LivingFinish,8,2.0},{"dining","Dining room","room",PlainFinish,6,2.0},{"kitchen","Kitchen","room",KitchenFinish,6,2.0},
    {"family","Family room","room",PlainFinish,7,2.0},{"study","Study","room",PlainFinish,5,2.0},{"wc","WC","room",BathFinish,3,3.0},
    {"bath","Bathroom","room",BathFinish,4,3.0},{"ensuite","Main bathroom","room",BathFinish,4,3.0},{"bedroom","Bedroom","room",BedroomFinish,6,2.0},
    {"main","Main bedroom","room",BedroomFinish,7,2.0},{"closet","Walk-in closet","room",ClosetFinish,3,3.0},{"utility","Utility room","room",StorageFinish,3,3.0},
    {"store","Store room","room",StorageFinish,3,3.0},{"den","Den","room",PlainFinish,5,2.0}};
const RoleInfo& Info(const std::string& role){for(auto& r:RoleTable)if(role==r.role)return r;return RoleTable[1];}
bool Circulation(const std::string& role){return role=="entry"||role=="hall"||role=="backhall"||role=="landing"||role=="uphall";}
bool Everyone(const std::string& role){return role=="living"||role=="dining"||role=="kitchen"||role=="family";}
bool Sleeping(const std::string& role){return role=="bedroom"||role=="main";}

struct Draws
{
    uint32_t s=0;
    int Pick(const std::string& name,int lo,int hi) const{return hi<=lo?lo:lo+int(Stream(s,"house",name)%uint32_t(hi-lo+1));}
    bool Chance(const std::string& name,int percent) const{return int(Stream(s,"house",name)%100u)<percent;}
};

// The plan being made: rooms by role on the grid, and the openings asked between them.
struct Room { std::string role;Plot r;int floor=0,ceiling=Ceiling;char foot=0; };
struct Door { int a=0,b=0;std::string mode;bool required=true; };
struct Plan
{
    std::vector<Room> rooms;std::vector<Door> doors;
    // Whether a rectangle is free on a floor. A stair takes its ground on both the storeys it joins.
    bool Free(const Plot& r,int floor) const
    {
        for(auto& q:rooms)if(Overlaps(r,q.r)&&(q.floor==floor||(q.role=="stair"&&q.floor+StoreyRise==floor)))return false;
        return true;
    }
    int Add(const std::string& role,const Plot& r,int floor){Room m;m.role=role;m.r=r;m.floor=floor;rooms.push_back(m);return int(rooms.size())-1;}
    void Link(int a,int b,const std::string& mode,bool required=true){doors.push_back({a,b,mode,required});}
};

// A frame on the plan: an origin and a direction (0 north, 1 east, 2 south, 3 west). u runs along the direction,
// v to its left.
const int DX[4]={0,1,0,-1},DY[4]={1,0,-1,0};
struct Frame { int x=0,y=0,dir=0; };
int LeftOf(int d){return (d+3)&3;}
int RightOf(int d){return (d+1)&3;}
Plot UV(const Frame& f,int u0,int u1,int v0,int v1)
{
    const int l=LeftOf(f.dir);
    const int ax=f.x+u0*DX[f.dir]+v0*DX[l],ay=f.y+u0*DY[f.dir]+v0*DY[l],bx=f.x+u1*DX[f.dir]+v1*DX[l],by=f.y+u1*DY[f.dir]+v1*DY[l];
    return Plot{std::min(ax,bx),std::min(ay,by),std::max(ax,bx),std::max(ay,by)};
}
Frame Move(const Frame& f,int u,int v){const int l=LeftOf(f.dir);return Frame{f.x+u*DX[f.dir]+v*DX[l],f.y+u*DY[f.dir]+v*DY[l],f.dir};}

// Rooms in a row along one side of a strip, sized to fill its length exactly. Each slot is drawn between lo and
// hi; while the row is too long, optional slots are dropped from its end and then slots shrink towards lo; while
// it is too short, slots grow towards hi (from a drawn one round), and then the absorbing slot past hi, by at
// most 6. False when no fit is found.
struct Slot { std::string role;int lo=0,hi=0;bool optional=false,absorb=false;int len=0; };
bool Fit(std::vector<Slot>& slots,int total,const Draws& d,const std::string& name)
{
    int sum=0;
    for(size_t k=0;k<slots.size();++k){slots[k].len=d.Pick(name+"/"+std::to_string(k)+"/"+slots[k].role,slots[k].lo,slots[k].hi);sum+=slots[k].len;}
    while(sum>total)
    {
        int drop=-1;for(int k=int(slots.size())-1;k>=0&&drop<0;--k)if(slots[k].optional)drop=k;
        if(drop<0)break;sum-=slots[drop].len;slots.erase(slots.begin()+drop);
    }
    while(sum>total){bool any=false;for(int k=int(slots.size())-1;k>=0&&sum>total;--k)if(slots[k].len>slots[k].lo){--slots[k].len;--sum;any=true;}if(!any)break;}
    if(sum>total||slots.empty())return false;
    const int n=int(slots.size()),start=d.Pick(name+"/grow",0,n-1);
    while(sum<total){bool any=false;for(int i=0;i<n&&sum<total;++i){Slot& sl=slots[(start+i)%n];if(sl.len<sl.hi){++sl.len;++sum;any=true;}}if(!any)break;}
    for(auto& sl:slots)while(sum<total&&sl.absorb&&sl.len<sl.hi+6){++sl.len;++sum;}
    return sum==total;
}

// What rooms the house has.
struct Program
{
    int bedrooms=3,familyBaths=1;bool ensuite=true,walkIn=true,dining=true,family=false,study=false,wc=false;
    int extraBaths=0,extraStores=0,extraBedrooms=0;bool secondKitchen=false,secondLiving=false;
};
Program MakeProgram(int size,int sprawl,int strange,const Draws& d)
{
    Program g;g.bedrooms=2+(size*3+50)/100;g.ensuite=g.bedrooms>=3;g.walkIn=size>=30;g.dining=size>=25||d.Chance("program/dining",50);
    g.family=size>=60;g.study=size>=45;g.wc=sprawl<SprawlOneStorey&&size>=35;g.familyBaths=g.bedrooms>=4?2:1;
    // (Repeated rooms: the strangeness that breaks the counts rule.)
    if(strange>=50){g.extraBaths=d.Pick("program/extra-baths",0,1+(strange-50)/25);g.extraStores=d.Pick("program/extra-stores",1,1+(strange-50)/20);}
    if(strange>=75)g.extraBedrooms=d.Pick("program/extra-bedrooms",1,2);
    if(strange>=80){g.secondKitchen=d.Chance("program/second-kitchen",40);g.secondLiving=d.Chance("program/second-living",40);}
    return g;
}

// A thing laid along a hall: a room; the main bedroom with its closet and bathroom behind it (a suite); a stretch
// of hall with nothing off it (a gap); or a side hall with its own things (a branch).
struct Item
{
    enum Kind { Room,Suite,Gap,Branch } kind=Room;
    std::string role;int len=0,depth=0;
    bool chain=false;               // A bedroom opened from the bedroom before it, not from the hall.
    std::vector<Item> branch;int branchLen=0;
};
Item RoomItem(const std::string& role,int len,int depth){Item i;i.role=role;i.len=len;i.depth=depth;return i;}

// Lays halls with things along them, into the plan; anything that does not fit is taken back out.
struct Halls
{
    Plan& P;const Draws& d;const Program& g;int floor=0;std::string& trouble;
    int ended=-1;                   // The last piece of the hall the latest Run laid (a long hall is laid in pieces).
    // A hall from f, hw wide, with items along each side, starting startAt along it. turn says which side the
    // next hall leaves by (0 none, 1 left, 2 right) and nextWide how wide it is: the items on that side stop
    // short of the corner. The hall is at least minLen long. Returns the hall's index and its length; -1 when
    // anything would stand on what stands already. A hall longer than one Piece may be is laid as several, joined
    // without a wall, each room opening off the piece it shares more wall with; ended is the last.
    int Run(const Frame& f,int hw,const std::vector<Item>& left,const std::vector<Item>& right,int turn,int nextWide,int& length,int startAt=0,int minLen=0,const std::string& name="run")
    {
        const size_t rooms0=P.rooms.size(),doors0=P.doors.size();
        auto fail=[&](const std::string& why){P.rooms.resize(rooms0);P.doors.resize(doors0);trouble=why;return -1;};
        const int hall=P.Add("hall",Plot{f.x,f.y,f.x,f.y},floor);
        int ends[2]={startAt,startAt};std::vector<std::pair<int,int>> spans;
        for(int side=0;side<2;++side)
        {
            const std::vector<Item>& items=side==0?left:right;int cursor=startAt,previous=-1;bool touching=false;
            // (v of a thing standing off the hall, depth deep, on this side.)
            auto band=[&](int u0,int u1,int a,int b){return side==0?UV(f,u0,u1,hw+a,hw+b):UV(f,u0,u1,-b,-a);};
            for(size_t k=0;k<items.size();++k)
            {
                const Item& it=items[k];
                if(it.kind==Item::Gap){cursor+=it.len;touching=false;continue;}
                bool placed=false;
                for(int tries=0;tries<20&&!placed;++tries,++cursor,touching=false)
                {
                    if(it.kind==Item::Branch)
                    {
                        // A side hall leaving square from this hall; its things stand clear of this side's rooms.
                        const Frame bf=side==0?Frame{Move(f,cursor+3,hw).x,Move(f,cursor+3,hw).y,LeftOf(f.dir)}:Frame{Move(f,cursor,0).x,Move(f,cursor,0).y,RightOf(f.dir)};
                        int blen=0;const std::string saved=trouble;const int outer=ended;
                        const int b=Run(bf,3,it.branch,{},0,0,blen,it.depth,it.branchLen,name+"/branch"+std::to_string(k));ended=outer;
                        if(b<0){trouble=saved;continue;}
                        P.Link(hall,b,"open");spans.push_back({cursor,cursor+3});cursor+=3;placed=true;previous=-1;break;
                    }
                    if(it.kind==Item::Suite)
                    {
                        // The bedroom, and beside it (along the hall) its closet next to the hall and its bathroom behind.
                        const int sw=4,cd=4,mb=it.len-sw;
                        const Plot bed=band(cursor,cursor+mb,0,it.depth);
                        const Plot clo=g.walkIn?band(cursor+mb,cursor+it.len,0,cd):Plot{0,0,0,0};
                        const Plot ens=band(cursor+mb,cursor+it.len,g.walkIn?cd:0,it.depth);
                        if(!P.Free(bed,floor)||!P.Free(ens,floor)||(g.walkIn&&!P.Free(clo,floor)))continue;
                        const int m=P.Add("main",bed,floor);P.Link(hall,m,"door");
                        if(g.ensuite){const int e=P.Add("ensuite",ens,floor);P.Link(m,e,"door");}
                        else{const int e=P.Add("closet",ens,floor);P.Link(m,e,"door");}
                        if(g.walkIn){const int c=P.Add("closet",clo,floor);P.Link(m,c,"door");}
                        spans.push_back({cursor,cursor+mb});cursor+=it.len;placed=true;previous=-1;break;
                    }
                    const Plot r=band(cursor,cursor+it.len,0,it.depth);if(!P.Free(r,floor))continue;
                    const int room=P.Add(it.role,r,floor);
                    if(it.chain&&previous>=0&&touching)P.Link(previous,room,"door");
                    else P.Link(hall,room,Everyone(it.role)||it.role=="study"?"wide":"door");
                    previous=Sleeping(it.role)?room:-1;spans.push_back({cursor,cursor+it.len});cursor+=it.len;placed=true;break;
                }
                if(!placed)return fail(name+": no room along the hall for "+(it.role.empty()?std::string("a side hall"):Info(it.role).title));
                touching=true;
            }
            ends[side]=cursor;
        }
        length=std::max({ends[0]+(turn==1?nextWide:0),ends[1]+(turn==2?nextWide:0),minLen,startAt+3,4});
        const Plot r=UV(f,0,length,0,hw);
        P.rooms[hall].r=Plot{0,0,0,0};
        if(!P.Free(r,floor))return fail(name+": the hall would stand on another room");
        // Pieces of at most 18 m, cut where every room keeps 2 m of wall on the piece it opens off.
        std::vector<int> cuts{0};
        const int pieces=(length+35)/36;
        for(int k=1;k<pieces;++k)
        {
            const int target=k*length/pieces;int best=target;
            for(int off=0;off<=8;++off)for(int sign:{1,-1})
            {
                const int u=target+sign*off;if(u<cuts.back()+4||u>length-4||best!=target)continue;bool clean=true;
                for(auto& sp:spans)if(sp.first<u&&u<sp.second&&(u-sp.first<4||sp.second-u<4))clean=false;
                if(clean)best=u;
            }
            cuts.push_back(best);
        }
        cuts.push_back(length);
        std::vector<int> piece{hall};P.rooms[hall].r=UV(f,cuts[0],cuts[1],0,hw);
        for(size_t k=1;k+1<cuts.size();++k){piece.push_back(P.Add("hall",UV(f,cuts[k],cuts[k+1],0,hw),floor));P.Link(piece[k-1],piece[k],"open");}
        for(size_t k=doors0;k<P.doors.size();++k)if(P.doors[k].a==hall&&piece.size()>1)
        {
            int best=hall,most=-1;for(int q:piece){const int s=SharedWall(P.rooms[q].r,P.rooms[P.doors[k].b].r);if(s>most){most=s;best=q;}}
            P.doors[k].a=best;
        }
        ended=piece.back();return hall;
    }
};
// The frame of the hall that leaves the end of one length long, by its left (turn 1) or right (turn 2) side.
Frame Turned(const Frame& f,int length,int hw,int turn,int nextWide)
{
    if(turn==1){const Frame m=Move(f,length,hw);return Frame{m.x,m.y,LeftOf(f.dir)};}
    const Frame m=Move(f,length-nextWide,0);return Frame{m.x,m.y,RightOf(f.dir)};
}

// The strangeness that falls on a list of things along halls: gaps where nothing opens off the hall, side halls
// that lead to a room or to nothing, and bedrooms opened one through another.
void Unsettle(std::vector<Item>& items,const Draws& d,int strange,const std::string& name,int depth)
{
    std::vector<Item> out;
    for(size_t k=0;k<items.size();++k)
    {
        const std::string at=name+"/"+std::to_string(k);
        if(strange>=30&&d.Chance(at+"/gap",strange-20)){Item g;g.kind=Item::Gap;g.len=d.Pick(at+"/gap-len",2,2+(strange-30)/8);out.push_back(g);}
        if(strange>=40&&d.Chance(at+"/branch",(strange-30)/2))
        {
            Item b;b.kind=Item::Branch;b.depth=depth;b.branchLen=depth+d.Pick(at+"/branch-len",3,3+(strange-40)/6);
            if(!(strange>=55&&d.Chance(at+"/branch-empty",strange-45)))b.branch.push_back(RoomItem(d.Chance(at+"/branch-what",50)?"store":"bath",d.Pick(at+"/branch-room",4,5),d.Pick(at+"/branch-deep",4,6)));
            out.push_back(b);
        }
        Item it=items[k];if(strange>=85&&Sleeping(it.role)&&it.kind==Item::Room)it.chain=d.Chance(at+"/chain",strange-60);
        out.push_back(it);
    }
    items=out;
}

// ---------------------------------------------------------------------------------------------------------
// Compact: a box on two storeys about a centre hall. Columns from west to east: wing A (LA wide), the stair
// strip (3), the hall (3), wing B (LB). Along y from the front: the entry across the strip and the hall; the
// stair rising north from it with a back hall behind it; the hall running on to the back. Upstairs the hall
// runs the whole depth, with a strip of hall over the entry and the landing at the stair's head.
bool Compact(Plan& P,const Program& g,const Draws& d,int size,int sprawl,int strange,std::string& trouble,int& entry)
{
    const int hw=3,E=size>=40?6:5,drift=strange>=20?(strange-10)/15:0;
    // (Up to the wing, sprawl widens and lengthens the box.)
    const int grow=std::min(sprawl,30);
    const int LA=Lerp(8,11,size)+d.Pick("compact/wing-a",0,1)+grow/15,LB=Lerp(8,10,size)+d.Pick("compact/wing-b",0,1)+grow/15;
    const int xS=LA,xH=LA+3,xB=LA+3+hw,xE=xB+LB;
    // (Colonial: living and dining rooms either side of the entry, the kitchen behind the dining room.)
    const bool colonial=d.Chance("compact/colonial",40);
    // Rooms that move into the back wing as the house sprawls; rooms that the strangeness adds there.
    const bool wing=sprawl>=30||strange>=40,mainDown=sprawl>=40,denInWing=sprawl>=30;
    const bool shuffle=strange>=70&&d.Chance("compact/shuffle",strange-40);
    // Ground floor, wing A and wing B.
    std::vector<Slot> ga,gb;
    if(!colonial)
    {
        ga.push_back({"living",std::max(9,E),12+drift,false,true});
        if(g.dining)ga.push_back({"dining",6,8+drift});
        ga.push_back({"kitchen",7,9+drift,false,true});
        // (Wing B: a study or den at the front, the WC and utility room, and a family room, den or study at the back.)
        const std::string front=g.study?"study":"den";
        gb.push_back({front,std::max(6,E),9+drift,false,true});
        if(g.wc)gb.push_back({"wc",4,4,true});
        gb.push_back({"utility",4,5+drift});
        gb.push_back({g.family?"family":front=="study"?"den":"study",6,10+drift,false,true});
    }
    else
    {
        ga.push_back({"living",std::max(9,E),12+drift,false,true});
        ga.push_back({g.family?"family":"study",7,10+drift,false,true});
        gb.push_back({"dining",std::max(7,E),9+drift,false,true});
        gb.push_back({"kitchen",8,10+drift,false,true});
        gb.push_back({"utility",4,5+drift});
        if(g.wc)gb.push_back({"wc",4,4,true});
    }
    if(shuffle){for(auto& s:ga)if(s.role=="kitchen")s.role="study";else if(s.role=="dining")s.role="bath";for(auto& s:gb)if(s.role=="utility")s.role="kitchen";}
    // Upstairs wing B: bedrooms (wing A holds two) and the family bathrooms.
    const int upstairsBedrooms=std::max(1,g.bedrooms-(mainDown?1:0));
    std::vector<Slot> ub;
    const int baths=g.familyBaths;
    for(int k=0;k<std::max(1,upstairsBedrooms-2);++k){ub.push_back({"bedroom",7,8+drift,false,true});if(k==0)for(int b=0;b<baths;++b)ub.push_back({"bath",4,5});}
    if(!g.study||colonial)ub.push_back({"study",6,8,true,true});
    ub.push_back({"store",4,5,true});
    auto least=[](const std::vector<Slot>& v){int s=0;for(auto& x:v)if(!x.optional)s+=x.lo;return s;};
    const int D=std::max({E+18,least(ga),least(gb),least(ub)})+d.Pick("compact/deep",0,1+size/50)+grow/10;
    if(!Fit(ga,D,d,"compact/ga")||!Fit(gb,D,d,"compact/gb")||!Fit(ub,D,d,"compact/ub")){trouble="the wings do not fill the house's depth";return false;}

    // The middle: entry, stair, back hall, hall.
    entry=P.Add("entry",Plot{xS,0,xB,E},0);
    const int stair=P.Add("stair",Plot{xS,E,xH,E+StairLong},0);P.rooms[stair].foot='s';
    const int back=P.Add("backhall",Plot{xS,E+StairLong,xH,D},0);
    const int hall=P.Add("hall",Plot{xH,E,xB,D},0);
    P.Link(entry,hall,"open");P.Link(entry,stair,"open");P.Link(back,hall,"open");
    // Wing A: the rooms open one into the next from the front; the one at the back opens onto the back hall.
    int y=0,prev=-1;std::vector<int> aRooms;
    for(auto& s:ga)
    {
        const int r=P.Add(s.role,Plot{0,y,xS,y+s.len},0);aRooms.push_back(r);
        if(prev<0)P.Link(entry,r,"wide");else P.Link(prev,r,s.role=="bath"?"door":"wide");
        prev=r;y+=s.len;
    }
    P.Link(prev,back,P.rooms[prev].role=="kitchen"?"wide":"door");
    // Wing B: each room opens off the entry or the hall, whichever it shares more wall with; in the colonial
    // plan the kitchen also opens from the dining room before it.
    y=0;prev=-1;
    for(auto& s:gb)
    {
        const Plot r{xB,y,xE,y+s.len};const int room=P.Add(s.role,r,0);
        const int to=SharedWall(r,P.rooms[entry].r)>=SharedWall(r,P.rooms[hall].r)?entry:hall;
        if(s.role=="kitchen"&&prev>=0&&P.rooms[prev].role=="dining")P.Link(prev,room,"wide");
        if(!(s.role=="kitchen"&&prev>=0&&P.rooms[prev].role=="dining")||d.Chance("compact/kitchen-hall",60))P.Link(to,room,Everyone(s.role)||s.role=="study"?"wide":"door");
        prev=room;y+=s.len;
    }

    // Upstairs.
    const int up=StoreyRise;
    const int upFront=P.Add("uphall",Plot{xS,0,xH,E},up),landing=P.Add("landing",Plot{xS,E+StairLong,xH,D},up),upHall=P.Add("uphall",Plot{xH,0,xB,D},up);
    P.Link(stair,landing,"open");P.Link(landing,upHall,"open");P.Link(upFront,upHall,"open");
    // Wing A: a bedroom at the front off the hall over the entry; a bedroom at the back off the landing; between
    // them what the back bedroom keeps (its bathroom and closet if it is the main bedroom, else a closet for each).
    {
        const bool mainUp=!mainDown;
        int f=d.Pick("up/front",7,9),m=d.Pick("up/middle",4,6);int b=D-f-m;
        while(b<8&&f>7){--f;++b;}while(b<8&&m>4){--m;++b;}
        while(b>12&&m<7){++m;--b;}while(b>12&&f<11){++f;--b;}
        if(b<7){trouble="no room upstairs for the back bedroom";return false;}
        const int front=P.Add("bedroom",Plot{0,0,xS,f},up);P.Link(upFront,front,"door");
        const int backRoom=P.Add(mainUp?"main":"bedroom",Plot{0,f+m,xS,D},up);P.Link(landing,backRoom,"door");
        if(mainUp&&g.ensuite)
        {
            if(g.walkIn){const int c=P.Add("closet",Plot{0,f,4,f+m},up);P.Link(backRoom,c,"door");const int e=P.Add("ensuite",Plot{4,f,xS,f+m},up);P.Link(backRoom,e,"door");}
            else{const int e=P.Add("ensuite",Plot{0,f,xS,f+m},up);P.Link(backRoom,e,"door");}
        }
        else
        {
            const int half=xS/2;const int c1=P.Add("closet",Plot{0,f,half,f+m},up),c2=P.Add("closet",Plot{half,f,xS,f+m},up);
            P.Link(front,c1,"door");P.Link(backRoom,c2,"door");
        }
    }
    // Wing B: each room off the upstairs hall; strange enough, a bedroom opens only through the one before it.
    y=0;prev=-1;
    for(size_t k=0;k<ub.size();++k)
    {
        const Slot& s=ub[k];const int room=P.Add(s.role,Plot{xB,y,xE,y+s.len},up);
        const bool chain=strange>=85&&Sleeping(s.role)&&prev>=0&&Sleeping(P.rooms[prev].role)&&d.Chance("up/chain/"+std::to_string(k),strange-60);
        P.Link(chain?prev:upHall,room,"door");prev=room;y+=s.len;
    }

    // The back wing: one storey from the end of the hall, taking a den, then the main bedroom, then turning.
    if(wing)
    {
        Halls h{P,d,g,0,trouble};std::vector<Item> left,right;
        const int depth=d.Pick("wing/depth",7,8);
        if(denInWing)(d.Chance("wing/den-side",50)?left:right).push_back(RoomItem(g.family&&colonial?"study":"family",d.Pick("wing/den",8,10),depth));
        if(strange>=40){left.push_back(RoomItem("bath",4,depth));right.push_back(RoomItem("store",4,depth));}
        for(int k=0;k<g.extraBaths;++k)left.push_back(RoomItem("bath",d.Pick("wing/xbath/"+std::to_string(k),4,5),depth));
        for(int k=0;k<g.extraStores;++k)right.push_back(RoomItem("store",4,depth));
        for(int k=0;k<g.extraBedrooms;++k)(k%2?left:right).push_back(RoomItem("bedroom",d.Pick("wing/xbed/"+std::to_string(k),7,8),depth));
        if(g.secondKitchen)left.push_back(RoomItem("kitchen",8,depth));
        Item suite;suite.kind=Item::Suite;suite.len=d.Pick("wing/suite",11,13);suite.depth=std::max(8,depth);suite.role="main";
        const bool turns=sprawl>=48||(strange>=60&&d.Chance("wing/turn-odd",strange-40));
        Unsettle(left,d,strange,"wing/left",depth);Unsettle(right,d,strange,"wing/right",depth);
        if(left.empty()&&right.empty()&&!mainDown){left.push_back(RoomItem("store",4,depth));}
        Frame f{xB,D,0};int len=0;
        if(!turns)
        {
            if(mainDown)(d.Chance("wing/suite-side",50)?left:right).push_back(suite);
            const int w=h.Run(f,hw,left,right,0,0,len,0,0,"wing");if(w<0)return false;P.Link(hall,w,"open");
        }
        else
        {
            const int turn=d.Chance("wing/turn",50)?1:2;const int w=h.Run(f,hw,left,right,turn,hw,len,0,6,"wing");if(w<0)return false;P.Link(hall,w,"open");const int wEnd=h.ended;
            std::vector<Item> l2,r2;if(mainDown)(turn==1?r2:l2).push_back(suite);else r2.push_back(RoomItem("store",4,depth));
            int len2=0;const int w2=h.Run(Turned(f,len,hw,turn,hw),hw,l2,r2,0,0,len2,0,0,"wing/turned");if(w2<0)return false;P.Link(wEnd,w2,"open");
        }
    }
    else if(mainDown){trouble="the main bedroom has no wing";return false;}
    return true;
}

// ---------------------------------------------------------------------------------------------------------
// Spread: one storey. From the front: the entry; the living room, passed through; the dining room, passed
// through, with the kitchen beside it; then halls that turn, with the bedrooms and bathrooms off them and the
// main bedroom's suite at the end.
bool Spread(Plan& P,const Program& g,const Draws& d,int size,int sprawl,int strange,std::string& trouble,int& entry)
{
    const int drift=strange>=20?(strange-10)/15:0;
    auto wide=[&](const std::string& name){return 3+(strange>=30?d.Pick(name,0,(strange-30)/25):0);};
    int hw=wide("hall/0");const Frame f{0,0,0};
    const int E=4+d.Pick("entry/deep",0,1);
    entry=P.Add("entry",UV(f,0,E,-2,hw+2),0);
    const bool shuffle=strange>=70&&d.Chance("spread/shuffle",strange-40);
    // The rows passed through: each a room across the spine, with a room or two beside it.
    struct Row { std::string through;int len=0;std::string side[2];int depth[2]={0,0}; };
    std::vector<Row> rows;
    {
        Row r;r.through="living";r.len=Lerp(9,12,size)+d.Pick("living/len",0,1);
        const int s=d.Pick("living/side",0,1);
        if(!g.dining&&!shuffle){r.side[s]="kitchen";r.depth[s]=d.Pick("kitchen/depth",(r.len+1)/2,9);}
        if(g.study&&d.Chance("living/study",50)&&r.side[1-s].empty()){r.side[1-s]="study";r.depth[1-s]=d.Pick("study/depth",(r.len+1)/2,(r.len+1)/2+1);}
        if(shuffle&&r.side[1-s].empty()){r.side[1-s]="bath";r.depth[1-s]=4;}
        rows.push_back(r);
    }
    if(g.dining)
    {
        Row r;r.through="dining";r.len=d.Pick("dining/len",7,9);const int k=d.Pick("kitchen/side",0,1);
        if(!shuffle){r.side[k]="kitchen";r.depth[k]=d.Pick("kitchen/depth",7,9);}
        if(d.Chance("dining/utility",60)){r.side[1-k]="utility";r.depth[1-k]=d.Pick("utility/depth",4,5);}
        rows.push_back(r);
    }
    if(g.secondLiving){Row r;r.through="living";r.len=d.Pick("living2/len",8,10);rows.push_back(r);}
    int cursor=E,last=entry;
    for(size_t k=0;k<rows.size();++k)
    {
        const Row& row=rows[k];const std::string at="row/"+std::to_string(k);
        const int tw=std::max(hw+4,Lerp(8,10,size)+d.Pick(at+"/wide",0,2)+drift),a=d.Pick(at+"/offset",2,tw-hw-2),b=tw-hw-a;
        const int through=P.Add(row.through,UV(f,cursor,cursor+row.len,-a,hw+b),0);P.Link(last,through,"wide");
        for(int s=0;s<2;++s)if(!row.side[s].empty())
        {
            const Plot r=s==0?UV(f,cursor,cursor+row.len,hw+b,hw+b+row.depth[s]):UV(f,cursor,cursor+row.len,-a-row.depth[s],-a);
            const int side=P.Add(row.side[s],r,0);P.Link(through,side,row.side[s]=="kitchen"||row.side[s]=="study"?"wide":"door");
        }
        cursor+=row.len;last=through;
    }
    // What lies off the halls, in order: rooms everyone uses first, bathrooms and bedrooms, the suite last.
    const int depth=d.Pick("halls/depth",7,8);
    std::vector<Item> items;
    if(g.family)items.push_back(RoomItem("family",d.Pick("halls/family",8,10),depth+1));
    if(g.study&&rows[0].side[0]!="study"&&rows[0].side[1]!="study")items.push_back(RoomItem("study",d.Pick("halls/study",6,7),depth));
    if(shuffle)items.push_back(RoomItem("kitchen",d.Pick("halls/kitchen",7,8),depth));
    bool utility=false;for(auto& r:rows)for(auto& s:r.side)utility|=s=="utility";
    if(!utility)items.push_back(RoomItem("utility",4,depth));
    const int others=g.bedrooms-1+g.extraBedrooms;
    for(int k=0;k<others;++k)
    {
        items.push_back(RoomItem("bedroom",d.Pick("halls/bedroom/"+std::to_string(k),7,8+drift),depth));
        if(k==0)for(int b=0;b<g.familyBaths;++b)items.push_back(RoomItem("bath",d.Pick("halls/bath/"+std::to_string(b),4,5),depth));
    }
    if(others==0)for(int b=0;b<g.familyBaths;++b)items.push_back(RoomItem("bath",4,depth));
    for(int k=0;k<g.extraBaths;++k)items.push_back(RoomItem("bath",4,depth));
    for(int k=0;k<g.extraStores;++k)items.push_back(RoomItem("store",4,depth));
    if(g.secondKitchen)items.push_back(RoomItem("kitchen",8,depth));
    // The halls: more of them the further it sprawls (and the stranger it is), each turning from the last.
    const int runs=std::clamp(1+(sprawl-SprawlOneStorey)/15+(strange>=60?d.Pick("halls/extra",0,1+(strange-60)/20):0),1,6);
    const int singleSided=std::max(0,(sprawl-SprawlOneStorey)*3/2);
    std::vector<std::vector<Item>> left(runs),right(runs);
    {
        const size_t per=(items.size()+runs-1)/size_t(runs);
        for(size_t k=0;k<items.size();++k)
        {
            const int r=std::min(runs-1,int(k/std::max<size_t>(1,per)));const std::string at="halls/"+std::to_string(r);
            const bool oneSide=d.Chance(at+"/single",singleSided);
            const bool toLeft=oneSide?d.Pick(at+"/single-side",0,1)==0:((k+d.Pick(at+"/first-side",0,1))%2==0);
            (toLeft?left[r]:right[r]).push_back(items[k]);
        }
        Item suite;suite.kind=Item::Suite;suite.role="main";suite.len=d.Pick("halls/suite",11,13);suite.depth=std::max(8,depth);
        (d.Chance("halls/suite-side",50)?left[runs-1]:right[runs-1]).push_back(suite);
        for(int r=0;r<runs;++r){Unsettle(left[r],d,strange,"halls/"+std::to_string(r)+"/left",depth);Unsettle(right[r],d,strange,"halls/"+std::to_string(r)+"/right",depth);}
    }
    // (Turns alternate, so the halls walk away from themselves; strange enough, a hall may turn the way the last
    // did, and the house doubles back on itself.)
    Halls h{P,d,g,0,trouble};Frame at=Move(f,cursor,0);int prev=last,lastTurn=d.Chance("halls/first-turn",50)?2:1;
    for(int r=0;r<runs;++r)
    {
        const std::string name="halls/"+std::to_string(r);const int next=wide(name+"/next");
        const bool again=strange>=60&&d.Chance(name+"/turn-again",strange-40);
        const int want=r==runs-1?0:(again?lastTurn:3-lastTurn);
        int len=0,hall=-1,turn=want;
        for(int option:{want,want==0?0:3-want})
        {
            turn=option;hall=h.Run(at,hw,left[r],right[r],turn,next,len,0,0,name);if(hall>=0)break;if(want==0)break;
        }
        if(hall<0)return false;
        P.Link(prev,hall,"open");prev=h.ended;
        if(r<runs-1){at=Turned(at,len,hw,turn,next);hw=next;lastTurn=turn;}
    }
    return true;
}

// Where an outside door could be cut in a room: its longest side with no room beyond it on its floor, at least
// 4 units of it. False when there is none.
bool Outside(const Plan& P,int k,char& side,double& x,double& y)
{
    const Plot& r=P.rooms[k].r;int best=0;
    for(char s:{'s','n','e','w'})
    {
        const int len=s=='s'||s=='n'?r.w():r.h();if(len<4||len<=best)continue;bool open=true;
        for(size_t q=0;q<P.rooms.size()&&open;++q)
        {
            if(int(q)==k||P.rooms[q].floor!=P.rooms[k].floor)continue;const Plot& o=P.rooms[q].r;
            const bool on=s=='s'?o.y1==r.y0:s=='n'?o.y0==r.y1:s=='e'?o.x0==r.x1:o.x1==r.x0;
            if(on&&SharedWall(r,o)>0)open=false;
        }
        if(!open)continue;best=len;side=s;
        x=s=='e'?r.x1:s=='w'?r.x0:(r.x0+r.x1)/2.;y=s=='n'?r.y1:s=='s'?r.y0:(r.y0+r.y1)/2.;
    }
    return best>0;
}

// ---------------------------------------------------------------------------------------------------------
// The house rules, and which dial values let each be broken.
void Rules(Result& out,int sprawl,int strange)
{
    const auto& S=out.spaces;std::map<std::string,int> at;for(int k=0;k<int(S.size());++k)at[S[k].instance]=k;
    std::vector<std::set<int>> next(S.size());
    for(auto& l:out.zone.scene.accepted)
    {
        const auto a=at.find(l.a.instance),b=at.find(l.b.instance);if(a==at.end()||b==at.end()||l.mode=="view")continue;
        next[a->second].insert(b->second);next[b->second].insert(a->second);
    }
    auto opensOnto=[&](int k,bool(*test)(const std::string&)){for(int n:next[k])if(test(S[n].role))return true;return false;};
    auto add=[&](const char* id,const char* name,bool kept,const std::string& detail,const std::string& relaxedBy,bool relaxed)
    {Rule r;r.id=id;r.name=name;r.kept=kept;r.detail=kept?std::string():detail;r.relaxedBy=relaxedBy;r.relaxed=relaxed;out.rules.push_back(r);};
    auto count=[&](const char* role){int n=0;for(auto& s:S)n+=s.role==role;return n;};
    const std::string strangeAt[]={"Strangeness 20","Strangeness 40","Strangeness 50","Strangeness 70","Strangeness 85"};
    out.rules.clear();
    // 1. The front door.
    {
        bool kept=false;for(auto& e:out.entrances)if(e.title=="Front door"){const auto k=at.find(e.instance);kept=k!=at.end()&&S[k->second].role=="entry";}
        add("entry","The front door opens into an entry hall",kept,"the front door opens into a room","",false);
    }
    // 2. The stair.
    {
        bool kept=true;std::string why;
        for(int k=0;k<int(S.size());++k)if(S[k].role=="stair")
        {
            bool foot=false,head=false;for(int n:next[k]){if(S[n].floor==S[k].floor&&Circulation(S[n].role))foot=true;if(S[n].floor>S[k].floor&&Circulation(S[n].role))head=true;}
            if(!foot||!head){kept=false;why=!foot?"the stair starts in a room":"the stair arrives in a room";}
        }
        add("stair","The stair rises from a hall to a landing",kept,why,"",false);
    }
    // 3. Shared rooms downstairs.
    {
        std::string why;for(auto& s:S)if((s.role=="living"||s.role=="dining"||s.role=="kitchen")&&s.storey!=0)why=s.title+" is upstairs";
        add("ground","The living room, dining room and kitchen are on the ground floor",why.empty(),why,"",false);
    }
    // 4, 5. Kitchen, dining and living rooms together.
    {
        const bool dining=count("dining")>0;std::string why;
        if(dining)for(int k=0;k<int(S.size());++k)if(S[k].role=="kitchen"&&!opensOnto(k,[](const std::string& r){return r=="dining";}))why="a kitchen does not open onto the dining room";
        add("kitchen","The kitchen opens onto the dining room",why.empty(),why,strangeAt[3],strange>=70);
        why.clear();
        for(int k=0;k<int(S.size());++k)if(S[k].role=="dining")
        {
            bool near=false;for(int n:next[k]){if(S[n].role=="living")near=true;if(Circulation(S[n].role))for(int m:next[n])if(S[m].role=="living")near=true;}
            if(!near)why="the dining room is not near the living room";
        }
        add("living","The living and dining rooms open into each other, or off the same hall",why.empty(),why,strangeAt[3],strange>=70);
    }
    // 6, 7. Bedrooms.
    {
        std::string why,priv;
        for(int k=0;k<int(S.size());++k)if(Sleeping(S[k].role))
        {
            if(!opensOnto(k,Circulation))why="a bedroom opens only through another room";
            if(opensOnto(k,Everyone)||opensOnto(k,[](const std::string& r){return r=="entry";}))priv="a bedroom opens onto the entry or a room everyone uses";
        }
        add("bedrooms","Every bedroom opens off a hall or landing",why.empty(),why,strangeAt[4],strange>=85);
        add("private","No bedroom opens onto the entry, living room, dining room or kitchen",priv.empty(),priv,strangeAt[3],strange>=70);
    }
    // 8, 9. Bathrooms.
    {
        std::string why,own;
        for(int k=0;k<int(S.size());++k)
        {
            if((S[k].role=="bath"||S[k].role=="wc")&&(!opensOnto(k,Circulation)||opensOnto(k,Everyone)))why=S[k].title+" does not open off a hall, or opens onto a room everyone uses";
            if(S[k].role=="ensuite")for(int n:next[k])if(S[n].role!="main")own="the main bathroom opens from somewhere other than the main bedroom";
        }
        add("baths","Bathrooms open off a hall, never onto the living room, dining room or kitchen",why.empty(),why,strangeAt[3],strange>=70);
        add("suite","The main bathroom opens only from the main bedroom",own.empty(),own,strangeAt[3],strange>=70);
    }
    // 10. Counts.
    {
        const int beds=count("bedroom")+count("main"),baths=count("bath")+count("ensuite");std::string why;
        if(count("kitchen")!=1)why="the house has "+std::to_string(count("kitchen"))+" kitchens";
        else if(count("living")!=1)why="the house has "+std::to_string(count("living"))+" living rooms";
        else if(baths<(beds>=4?2:1))why="too few bathrooms for "+std::to_string(beds)+" bedrooms";
        else if(baths>beds+1)why=std::to_string(baths)+" bathrooms for "+std::to_string(beds)+" bedrooms";
        add("counts","One kitchen, one living room, and bathrooms to suit the bedrooms",why.empty(),why,strangeAt[2],strange>=50);
    }
    // 11. Proportions.
    {
        std::string why;
        for(auto& s:S)
        {
            const RoleInfo& info=Info(s.role);if(std::string(info.kind)!="room")continue;
            const int narrow=std::min(s.rect.w(),s.rect.h()),broad=std::max(s.rect.w(),s.rect.h());
            if(narrow<info.least||broad>info.aspect*narrow+.01)why=s.title+" is "+std::to_string(s.rect.w()/2.).substr(0,4)+" by "+std::to_string(s.rect.h()/2.).substr(0,4)+" m";
        }
        add("proportions","Every room is a usable size and shape for what it is",why.empty(),why,strangeAt[0],strange>=20);
    }
    // 12, 13. Halls.
    {
        double halls=0,all=0;for(auto& s:S)if(s.role!="stair"){const double a=s.rect.area();all+=a;if(Circulation(s.role))halls+=a;}
        const double share=all>0?halls/all:0;
        add("halls","Halls take no more than a quarter of the floor",share<=.25,std::to_string(int(share*100+.5))+"% of the floor is hall",sprawl>=30?"Sprawl 30":"Strangeness 30",sprawl>=30||strange>=30);
        // (The entry's other way out is the front door.)
        std::string why;for(int k=0;k<int(S.size());++k)if(Circulation(S[k].role)&&S[k].role!="entry"&&next[k].size()<2)why=S[k].title+" leads nowhere";
        add("dead-ends","No hall leads nowhere",why.empty(),why,strangeAt[1],strange>=40);
    }
    // 14, 15. The ground floor: a box (or a box with one wing), with a way round.
    {
        Plot box{INT_MAX,INT_MAX,INT_MIN,INT_MIN};double area=0;std::vector<int> ground;
        for(int k=0;k<int(S.size());++k)if(S[k].storey==0){const Plot& r=S[k].rect;box={std::min(box.x0,r.x0),std::min(box.y0,r.y0),std::max(box.x1,r.x1),std::max(box.y1,r.y1)};area+=r.area();ground.push_back(k);}
        const double cover=box.x1>box.x0?area/double(box.area()):0;
        add("compact","The house is a box, or a box with a wing",cover>=.7,"its rooms cover "+std::to_string(int(cover*100+.5))+"% of the ground they stand in",sprawl>=30?"Sprawl 30":"Strangeness 40",sprawl>=30||strange>=40);
        std::vector<int> group(S.size());for(int k=0;k<int(S.size());++k)group[k]=k;
        auto find=[&](int v){while(group[v]!=v)v=group[v]=group[group[v]];return v;};int nodes=0,edges=0,joins=0;
        for(int k:ground)if(S[k].role!="stair"){++nodes;for(int n:next[k])if(n>k&&S[n].storey==0&&S[n].role!="stair"){++edges;if(find(k)!=find(n)){group[find(k)]=find(n);++joins;}}}
        const bool loop=edges>joins;(void)nodes;
        add("loop","The ground floor can be walked round in a loop",loop,"every way through the ground floor comes back the way it went",sprawl>=SprawlOneStorey?"Sprawl 55":"Strangeness 40",sprawl>=SprawlOneStorey||strange>=40);
    }
}
}

void House(const Spec& spec,Result& out)
{
    Zones::Zone& z=out.zone;const int size=DialValue(spec,"size"),sprawl=DialValue(spec,"sprawl"),strange=DialValue(spec,"strange");
    for(int attempt=0;attempt<Attempts;++attempt)
    {
        z.attempts=attempt+1;const uint32_t s=Stream(z.seed,"attempt",std::to_string(attempt));const Draws d{s};
        const Program g=MakeProgram(size,sprawl,strange,d);Plan P;std::string trouble;int entry=-1;
        const bool laid=sprawl<SprawlOneStorey?Compact(P,g,d,size,sprawl,strange,trouble,entry):Spread(P,g,d,size,sprawl,strange,trouble,entry);
        if(!laid){z.error="the house could not be laid ("+trouble+")";z.log+="attempt "+std::to_string(attempt)+": "+trouble+"; ";continue;}
        // Mirrored east to west by a draw; ceilings that change from room to room, where nothing stands above or below.
        if(d.Chance("mirror",50))for(auto& r:P.rooms)r.r=Plot{-r.r.x1,r.r.y0,-r.r.x0,r.r.y1};
        if(strange>=85)for(size_t k=0;k<P.rooms.size();++k)
        {
            bool stacked=false;for(auto& o:P.rooms)stacked|=o.floor!=P.rooms[k].floor&&Overlaps(o.r,P.rooms[k].r);
            if(!stacked&&P.rooms[k].role!="stair"&&d.Chance("ceiling/"+std::to_string(k),strange-70))P.rooms[k].ceiling=220+10*d.Pick("ceiling-height/"+std::to_string(k),0,13);
        }
        // Laid as Pieces and joined.
        std::vector<Part> parts;std::vector<Templates::Link> links;std::map<std::string,int> named;bool ok=true;
        for(auto& r:P.rooms)
        {
            const RoleInfo& info=Info(r.role);Part part;Templates::LayPiece& p=part.lay;const int n=++named[r.role];
            p.area="house";p.role=n==1?r.role:r.role+"-"+std::to_string(n);p.theme="residential";p.seed=Stream(s,"room/"+p.role,"seed");
            p.rect=r.r;p.floor=r.floor;p.ceiling=r.ceiling;part.title=info.title;part.kind=info.kind;part.role=r.role;
            if(r.role=="stair"){p.definition="ramp";p.params={{"rise",StoreyRise},{"run",StairRun}};p.foot=r.foot;}
            else{p.definition="space";p.params=PlainRoom;if(info.finish)p.params["role"]=info.finish;}
            if(!Put(part,&trouble)){ok=false;break;}
            parts.push_back(std::move(part));
        }
        for(size_t k=0;k<P.doors.size()&&ok;++k)
        {
            const Door& door=P.doors[k];std::string why;
            if(!Join(parts[door.a],parts[door.b],door.mode,door.required,links,&why)&&door.required){ok=false;trouble=parts[door.a].title+" to "+parts[door.b].title+": "+why;}
        }
        if(!ok){z.error="the house could not be laid ("+trouble+")";z.log+="attempt "+std::to_string(attempt)+": "+trouble+"; ";continue;}
        if(!Finish(out,parts,links,"house")){z.log+="attempt "+std::to_string(attempt)+": "+z.error+"; ";continue;}
        const Plot& e=P.rooms[entry].r;z.startX=(e.x0+e.x1)/2;z.startY=(e.y0+e.y1)/2;z.startZ=0;
        out.entrances.clear();
        {Entrance front;front.title="Front door";front.instance=parts[entry].instance.id;front.x=(e.x0+e.x1)/2.;front.y=e.y0;front.side='s';out.entrances.push_back(front);}
        for(size_t k=0;k<P.rooms.size();++k)if(P.rooms[k].role=="kitchen"&&P.rooms[k].floor==0)
        {
            Entrance back;if(Outside(P,int(k),back.side,back.x,back.y)){back.title="Back door";back.instance=parts[k].instance.id;out.entrances.push_back(back);break;}
        }
        Rules(out,sprawl,strange);
        std::string broken;for(auto& r:out.rules)if(!r.kept&&!r.relaxed)broken=r.name+": "+r.detail;
        if(!broken.empty()){z.error="a house rule was broken ("+broken+")";z.log+="attempt "+std::to_string(attempt)+": "+broken+"; ";continue;}
        z.error.clear();return;
    }
    if(z.error.empty())z.error="no attempt was accepted";
}
}

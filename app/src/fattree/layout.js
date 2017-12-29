/*
TreeScope, Version 1.0
Author Harsh Bhatia
LLNL-CODE-743437

Copyright (c) 2017, Lawrence Livermore National Security, LLC.
Produced at the Lawrence Livermore National Laboratory.
Written by Harsh Bhatia, hbhatia@llnl.gov. LLNL-CODE-743437.

All rights reserved.

This file is part of TreeScope. For details, see https://github.com/LLNL/TreeScope.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/


import Topology from '../model/topology';

// -----------------------------------------------------------------------------
let layout_idea = 3;    // 0: original, 1: compressed, 2: compressed & shifted
                        // 3: new (L3 in between)
//let layout_dir = 'unknown';
let layout_type = 'unknown';

let pixel_size = 10;                            // size of a colored pixel
let pixel_sep = 1;                              // separation between adjacent pixels


// -----------------------------------------------------------------------------
// for new layouts, l2 and l3 switches are split left and right of the center axis
// in the order of index, these functions tell where to draw the split

function l3split() {  return Topology.L3() / 2; }
function l2split() {  return Topology.L2() / Topology.nPods() / 2;  }

// -----------------------------------------------------------------------------
export function set_type(_) {   layout_type = _;      }
//export function set_dir(_) {    layout_dir = _;       }
export function set_pixsz(_) {  pixel_size = _;       }

export function pix_sz() {    return pixel_size;    }
export function pix_sep() {   return pixel_sep;     }

// size of a link
function box_sz() {           return pix_sz() + pix_sep();    }

// to force a gap between up and down links
function dir_gap() {
  return 0.5*box_sz();
}

export function pod_sz() {
  return Topology.isnull() ? {  w: 0, h: 0  } : { w: pod.w(), h: pod.h()  };
}

// -----------------------------------------------------------------------------
// SVG coordinate system starts from top left

const matrix = {
  w: () => {
          let n = Topology.L2L1();

          if(layout_idea == 0){
            return n*box_sz() - pix_sep();
          }
          if(layout_idea == 1){
            return (layout_type == 'blocked')     ?   n*switches[2].sz() - pix_sep() :
                   (layout_type == 'interleaved') ? n/2*switches[2].sz() - pix_sep() - 2*switches[2].sep(): 0;
          }
          if(layout_idea == 2){
            return (layout_type == 'blocked')     ? n*switches[2].sz() - pix_sep() :
                   (layout_type == 'interleaved') ? n*switches[2].sz() - pix_sep() - 2*switches[2].sep() : 0;
          }
          return 0;
        }
};
const core = {
  margin: () => box_sz(),
  l3gap: () => {
                return switches[3].w() + core.margin();
              },
  w: () => {
              return (layout_type == 'blocked')     ? dir_gap() + Topology.L2percoreperpod()*2*box_sz() - pix_sep() :
                     (layout_type == 'interleaved') ? Topology.L2percoreperpod()*switches[2].sz() - (pix_sep() + switches[2].sep()) : 0;
            },
  h: () => {  return Topology.L3percore()*box_sz(); }
};
const pod = {
  w: () => {
              if(layout_idea == 3){
                return switches[1].w() + core.margin() +
                        Topology.nCores() * (core.w() + core.l3gap() + core.margin()) - core.l3gap() - core.margin();
              }
              if(layout_idea == 0){
                return matrix.w() + core.margin() + switches[1].w();
              }
              if(layout_idea == 1){
                return 2*matrix.w() + 2*core.margin() + switches[1].w();
              }
              if(layout_idea == 2){
                return (layout_type == 'blocked')     ? 2*matrix.w() + 2*core.margin() + switches[1].w() :
                       (layout_type == 'interleaved') ?   matrix.w() +   core.margin() + switches[1].w() : 0;
              }
              return 0;
             },
  h: () => {
            if(layout_idea == 3){
              return switches[3].oy() + Topology.L2L3()*box_sz() - pix_sep();
            }
            if(layout_idea == 0){
              return switches[3].oy() + Topology.L3()*box_sz() - pix_sep();
            }
            if(layout_idea == 1 || layout_idea == 2){
              return switches[3].oy() + Topology.L2L3()*box_sz() - pix_sep();
            }
            return 0;
          }
};
const switches = {
  margin: () => pix_sz(),
  0: {
    w: () => pix_sz(),
    h: () => pix_sz(),
  },
  1: {
    ox: () => 0,
    oy: () => 0,
    w: () => {    if(layout_idea == 3){   return 7*pix_sz();  }
                  if(layout_idea == 0){   return 3*pix_sz();  }
                  if(layout_idea == 1){   return 7*pix_sz();  }
                  if(layout_idea == 2){   return 7*pix_sz();  }
                },
    h: () => pix_sz(),

    x: (s) => {
                if(layout_idea == 3){   return switches[1].ox();            }
                if(layout_idea == 0){   return switches[1].ox();            }
                if(layout_idea == 1){   return matrix.w() + core.margin();  }
                if(layout_idea == 2){
                  return (layout_type == 'blocked')     ? matrix.w() + core.margin() :
                         (layout_type == 'interleaved') ? switches[1].ox() : 0;
                }
                return 0;
              },
    y: (s) => box_sz() * (s.idx%Topology.L2L1()),
  },
  2: {
    ox: () => switches[1].ox() + switches[1].w() + core.margin(),
    //oy: () => Topology.L1L2()*box_sz() - pix_sep() + core.margin(),
    oy: () => Topology.L1()/Topology.nPods()*box_sz() - pix_sep() + core.margin(),

    offset_x_dir: (s) => {

              if(layout_idea == 0){               return 0;         }
              if(layout_type == 'interleaved'){   return box_sz();  }

              if(layout_type == 'blocked') {

                if(layout_idea == 3) {
                  return dir_gap() + Topology.L2percoreperpod()*box_sz();
                }

                let idx = s.idx%Topology.L1L2();
                let split = l2split();

                if(layout_idea == 1){
                  return (idx < split) ? split*box_sz() : -split*box_sz();
                }
                if(layout_idea == 2) {
                  return -1*(switches[1].x(s) + switches[1].w() + core.margin());
                }
              }
              return 0;
        },

    w: () => {
                  if(layout_idea == 0){
                    return pix_sz();
                  }
                  if(layout_idea == 1 || layout_idea == 2 || layout_idea == 3){
                    return (layout_type == 'blocked')     ? pix_sz() :
                           (layout_type == 'interleaved') ? 2*pix_sz()+pix_sep() : 0;
                  }
                },
    h: () => pix_sz() * 3,

    sep: () =>    (layout_type == 'interleaved' ? 2*pix_sep() : 0),

    // size of l2 switch (blocked vs interleaved)
    sz: () => {
                  return (layout_type == 'blocked') ?     box_sz() :
                         (layout_type == 'interleaved') ? 2*(box_sz() + switches[2].sep()) : 0;
              },


    x: (s) => {
                let l1 = switches[1];
                let l2 = switches[2];

                let idx = s.idx%Topology.L1L2();

                if(layout_idea == 3){
                  return l2.ox() + s.coreid*(core.w() + core.l3gap() + core.margin()) +
                          (idx%Topology.L2percoreperpod())*l2.sz();
                }

                if(layout_idea == 0){
                  return l2.ox() + idx*box_sz();
                }
                if(layout_idea == 1) {

                  let split = l2split();
                  let orig_l = l1.x(s) - core.margin() - (l2.sz() - pix_sep());
                  let orig_r = l1.x(s) + l1.w() + core.margin();

                  if (idx < split) {  return orig_r + idx*l2.sz();  }
                  else {
                    return (layout_type == 'blocked')     ? orig_l - (idx-split)*l2.sz() :
                           (layout_type == 'interleaved') ? orig_l - (idx-split)*l2.sz() + 4*pix_sep() : 0;
                                                                        // 4*pix_sep needed to balance.. missing something
                  }
                }
                if(layout_idea == 2){

                  let orig_r = l1.x(s) + l1.w() + core.margin();
                  return (layout_type == 'blocked')     ? orig_r  + idx*l2.sz() :
                         (layout_type == 'interleaved') ? l2.ox() + idx*l2.sz() : 0;
                }
          },
    y: (s) => switches[2].oy(),
  },
  3: {
    ox: () => switches[1].ox() + switches[1].w() - switches[3].w(),
    oy: () => switches[2].oy() + switches[2].h() + core.margin(),
    w: () => pix_sz() * 3,
    h: () => pix_sz(),
    x: (s) => {
                  const l1 = switches[1];
                  const l3 = switches[3];

                  if(layout_idea == 3){
                    return l3.ox() + s.coreid * ( l3.w() + core.margin() + core.w() + core.margin() );
                  }
                  if(layout_idea == 0){
                   return l3.ox();
                  }
                  if(layout_idea == 1 || layout_idea == 2){
                    return (s.idx < l3split()) ? l1.x(s) : l1.x(s) + core.margin() + l3.w();
                  }
      },
    y: (s) => {
                  const l3 = switches[3];

                  if(layout_idea == 3){
                    return l3.oy() + (s.idx%Topology.L3percore())*box_sz();
                  }
                  if(layout_idea == 0){
                   return l3.oy() + s.idx*box_sz();
                  }
                  if(layout_idea == 1 || layout_idea == 2){
                    let split = l3split();
                    return (s.idx < split) ? l3.oy() + s.idx*box_sz() : l3.oy() + (s.idx-split)*box_sz();
                  }
      }
  }
};

export function type() {
  return layout_type;
}
export function offset_x_dir(sw) {

  return (sw.lvl != 2) ? 0 :
         (layout_type == 'interleaved') ? 0: switches[sw.lvl].offset_x_dir(sw);
}

export function link_loc(link) {

  let a = link.nodefrom;
  let b = link.nodeto;

  if(layout_idea == 0) {
    if (a.lvl == 2)
      [a,b] = [b,a];

    return {
      x: switches[b.lvl].x(b),
      y: switches[a.lvl].y(a),
      w: pix_sz(),
      h: pix_sz()
    };
  }

  if(layout_idea == 1 || layout_idea == 2 || layout_idea == 3) {

    if ((a.lvl == 2 && b.lvl == 3) || (a.lvl == 3 && b.lvl == 2)){
      [a,b] = [b,a];

      if(layout_idea != 1){
        if(link.type == "up") {
          return {
            x: switches[b.lvl].x(b) + switches[b.lvl].offset_x_dir(a),
            y: switches[a.lvl].y(a),
            w: pix_sz(),
            h: pix_sz()
          };
        }
        else {
            return {
              x: switches[a.lvl].x(a),
              y: switches[b.lvl].y(b),
              w: pix_sz(),
              h: pix_sz()
            };
        }
      }
    }

    if(link.type == "up") {
      return {
        x: switches[b.lvl].x(b),
        y: switches[a.lvl].y(a),
        w: pix_sz(),
        h: pix_sz()
      };
    }
    else {
        return {
          x: switches[a.lvl].x(a) + switches[a.lvl].offset_x_dir(a),
          y: switches[b.lvl].y(b),
          w: pix_sz(),
          h: pix_sz()
        };
    }
  }
}

export function switch_loc(sw) {

  return {
    x: switches[sw.lvl].x(sw),
    y: switches[sw.lvl].y(sw),
    w: switches[sw.lvl].w(),
    h: switches[sw.lvl].h()
  };
}

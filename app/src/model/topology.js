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

 import * as d3 from 'd3';

// -------------------------------------------
// network information
// -------------------------------------------

let metadata = null;

let nodes = new Map();     // end nodes
let nodename2nodeid = new Map();

let switches = new Map();  // switches
let lids = new Map();      // lid to node/switch id

// ---------------------------------------------
function save_topology(data) {

  metadata = {
    name: data.name,
    num_cores: data.num_cores,
    num_pods: data.num_pods,
    num_L1L0: data.num_L1L0,
    num_L1L2: data.num_L1L2,
    num_L2L1: data.num_L2L1,
    num_L2L3: data.num_L2L3,
    num_L3L2: data.num_L3L2,
    nums: [0,0,0,0],
    corenames: new Map(),
  };

  for (let node of data.nodes) {
    node.lvl = 0;
    nodes.set(node.id, node);
    lids.set(node.lid, node.id);
    nodename2nodeid.set(node.desc.split(' ')[0], node.id)
  }
  metadata.nums[0] = nodes.size;

  for (let swtch of data.switches) {

    metadata.nums[swtch.lvl]++;

    if (swtch.core != null) {
      if (metadata.corenames.get(swtch.core) == null){
        metadata.corenames.set(swtch.core, metadata.corenames.size);
      }
      swtch.coreid = metadata.corenames.get(swtch.core);
    }
    switches.set(swtch.id, swtch);
    lids.set(swtch.lid, swtch.id);
  }
  logger.log("   Topology.load finished! Found", nodes.size, "nodes and", switches.size, "switches;", lids.size, "lids!; network:", metadata);

  if(metadata.num_cores != metadata.corenames.size) {
    throw Error("Topology.load failed: Expected " + metadata.num_cores + ' cores, but found ' + metadata.corenames.size)
  }
}

function load(dataname) {

  logger.log(' Topology.load(', dataname, ')');

  let topo = null;
  return fetch (dataname)
          .then(response => response.json())
          .then(save_topology);
}

function L1_for_nodes(nodeids){

  logger.log( 'Topology.L1_for_nodes()');
  logger.log(nodeids)

  let L1switches = [];
  nodeids.forEach( function(nid) {
    logger.log(nid)
  });
}

function node_or_switch_by_id(id){
  let n = switches.get(id);
  if( n != null )   return n;
  return nodes.get(id);
}

// ---------------------------------------------
export default {

  load(filename) {      return load(filename);  },

  mdata() {             return metadata; },
  get nodes() {         return nodes; },
  get switches() {      return switches;},

  node_by_name(name) {  return nodes.get( nodename2nodeid.get(name));  },
  node_by_id(id){       return nodes.get(id);    },
  switch_by_id(id){     return switches.get(id); },

  L1_for_nodes(nodeid){ return L1_for_nodes(nodeid);  },

  node_or_switch_by_id(id){   return node_or_switch_by_id(id);  },
  node_or_switch_by_lid(lid){
    return node_or_switch_by_id( lids.get(lid) );
  },

  is_node(id) {     return nodes.get(id) != null;  },
  is_switch(id) {   return switches.get(id) != null;  },
  isnull() {   return metadata == null;  },

  nLevels() { return 4; },
  nPods() {  return (metadata == null) ? 0 : metadata.num_pods; },
  nCores() { return (metadata == null) ? 0 : metadata.num_cores; },

  L0() {     return (metadata == null) ? 0 : metadata.nums[0];   },
  L1() {     return (metadata == null) ? 0 : metadata.nums[1];   },
  L2() {     return (metadata == null) ? 0 : metadata.nums[2];   },
  L3() {     return (metadata == null) ? 0 : metadata.nums[3];   },

  L3percore() {
    return (metadata == null) ? 0 :
                  metadata.nums[3] / metadata.num_cores;
  },
  L2percoreperpod() {
    return (metadata == null) ? 0 :
                  metadata.nums[2] / metadata.num_pods / metadata.num_cores;
  },

  L0L1() {   return (metadata == null) ? 0 : 1; },
  L1L0() {   return (metadata == null) ? 0 : metadata.num_L1L0; },
  L1L2() {   return (metadata == null) ? 0 : metadata.num_L1L2; },
  L2L1() {   return (metadata == null) ? 0 : metadata.num_L2L1; },
  L2L3() {   return (metadata == null) ? 0 : metadata.num_L2L3; },
  L3L2() {   return (metadata == null) ? 0 : metadata.num_L3L2; }
}
// ---------------------------------------------

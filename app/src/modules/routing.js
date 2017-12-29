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
 import Topology from '../model/topology.js'
 import {publish,subscribe} from '../utils/pubsub.js'


/* -------------------------------------------------------------------------- */
const date2string_fileTable = d3.timeFormat('%Y.%m.%d %H:%M:%S'); // time to string

let data = new Map();
let dropdown = null;
let activertable = null;

let jobs_routes = {dlids: [], nodes: [], links: []};

/* -------------------------------------------------------------------------- */

function select_time(tstamp_string) {
  activertable = data.get( tstamp_string );
}

function parse(text) {

  // parse the routing table now
  let colonparser = d3.dsvFormat(':');

  let rows = d3.csvParseRows(text);
  rows.shift();

  let rtable = new Map();
  for (let row of rows) {

    let node_id = row[0];
    let lidmap = new Map();
    let portmap = new Map();

    row.shift();    // skip the nodeid
    for(let i in row) {

      // fix the file so there is no comma in the end
      if(row[i].length == 0) {
        continue;
      }
      let dt = colonparser.parseRows(row[i]);

      let lid = +dt[0][0];
      let portnum = +dt[0][1];

      lidmap.set( lid, portnum );
      if(portmap.has(portnum)){   portmap.get(portnum).add(lid);          }
      else {                      portmap.set(portnum, new Set([lid]));   }
    }

    rtable.set( node_id, {lidmap: lidmap, portmap: portmap});
  }
  return rtable;
}

function load(tstamp, filename) {

  //logger.log(' Routing.load(', filename, ')');
  return fetch(filename)
          .then(response => response.text())
          .then(parse)
          .then((rtable) => { data.set(date2string_fileTable(tstamp), rtable);  });
}

/* -------------------------------------------------------------------------- */
// route between source node and dest lid

function find_route(snode, dlid, route) {

  //console.log('find_route(',snode, ',', dlid, ')')
  //TODO: pick the routing table based on the UI choice
/*
  let ts = Array.from(data.keys());
  activertable = data.get(ts[0])
*/
  if (activertable == undefined){
    console.log('activertable not found')
    return;
  }

  let cnt = 0;

  route.nodes.add(snode.lid);
  while (snode.lid != dlid) {

    if (cnt ++ > 8){
      console.error('failed to find the route.. exceeded 8 attempts')
      break
    }
    //console.log('while', snode, '.dlid !=', dlid)
    let port = undefined;

    if (snode.lvl == 0) {
      port = snode.ports[0];
    }
    else {
      let swtch = activertable.get(snode.id);
      if (swtch == undefined){
        console.error('find_route could not find switch', snode.id, snode.lvl);
        break;
      }
      port = snode.ports[swtch.lidmap.get(dlid)-1]
    }

    if (port == undefined){
      console.error('find_route could not find forwarding port for', snode);
      break;
    }

    let nnode = Topology.node_or_switch_by_id(port.dest_node);

    route.links.add( snode.lid.toString() + '-' + nnode.lid.toString() );
    route.nodes.add( nnode.lid );
    snode = nnode;
  }
}

/* -------------------------------------------------------------------------- */

function jobs_selected(jdata) {

  //console.log('routing.jobs_selected', jdata)

  let jroutes = [];
  jdata.jobs.forEach( job => {

    let jroute = {dlids: [], nodes: new Set(), links: new Set()};

    let snodes = job._l1.map(n => Topology.switch_by_id(n.id))
                        .filter(n => n != undefined);

    jroute.dlids = job._l0.map(n => Topology.node_by_id(n))
                       .filter(n => n != undefined)
                       .map(n => n.lid);

    //console.log('have ', snodes.length, 'sources and ', jroute.dlids.length, 'destinations')
    snodes.forEach(s => {
    jroute.dlids.forEach(d => {
      find_route(s, d, jroute);
    })
    });

    jroutes.push(jroute);
  });

  //console.log('done finding routes')


  // compute the final route to be shown
    // nodes should be the union and links should be the intersection
  jobs_routes.nodes = new Set();
  jobs_routes.dlids = new Set();
  jobs_routes.links = [];//new Set();

  jroutes.forEach( (jroute, i) => {

    jroute.nodes.forEach(n => jobs_routes.nodes.add(n));
    jroute.dlids.forEach(n => jobs_routes.dlids.add(n));

    if (i == 0){
      jroute.links.forEach(n => jobs_routes.links.push(n));
    }
    else {
      jobs_routes.links = jobs_routes.links.filter(d => jroute.links.has(d));
    }

    console.log('added', jroute.dlids.length, jroute.nodes.size, jroute.links.size,
                'made', jobs_routes.dlids.length, jobs_routes.nodes.size, jobs_routes.links.size)
  });

  jobs_routes.nodes = Array.from(jobs_routes.nodes);
  jobs_routes.dlids = Array.from(jobs_routes.dlids);
  //jobs_routes.links = Array.from(jobs_routes.links);

  console.log(' found route {', jobs_routes.dlids.length, jobs_routes.nodes.length, jobs_routes.links.length, '}')
  publish('route_found', jobs_routes);
}

/* -------------------------------------------------------------------------- */

function dlids4link(lnk, dir) {

  //TODO: pick the routing table based on the UI choice
/*
  let ts = Array.from(data.keys());
  activertable = data.get(ts[0])
*/
  if (activertable == undefined){
    console.log('activertable not found')
    return;
  }

  let snode = (dir == 1) ? activertable.get(lnk.nodefrom.id) : activertable.get(lnk.nodeto.id);
  let dport = (dir == 1) ? lnk.port_idx : lnk.portto;

  //console.log(snode)
  //console.log(dport)
  return Array.from(snode.portmap.get(dport));
}

/* -------------------------------------------------------------------------- */
function fattree_components_selected(fdata) {

  //console.log(fdata)

  let troutes = {dests: [], nodes: new Set(), links: new Set()};
  let src = [];
  let dst = [];

  // -------------------------------------------------------------
  // decide sources and destinations

  let switchbased = (fdata.nodes.selectedLeft.length > 0) ||
                    (fdata.nodes.selectedRight.length > 0);

  let linkbased = (fdata.links.selectedLeft.length > 0) ||
                  (fdata.links.selectedRight.length > 0);

  if (switchbased && linkbased) {
    console.error('cannot route both on switch and links');
    return;
  }

  // --- switch based
  if (switchbased) {

    if (fdata.nodes.selectedLeft.length > 0) {
      src = src.concat( fdata.nodes.selectedLeft );
    }
    if (fdata.nodes.selectedRight.length > 0) {

      let dnode = fdata.nodes.selectedRight[0];
      //console.log(dnode)

      if (dnode.lvl == 1) {

        dnode.ports.forEach(p => {
          let n = Topology.node_by_id(p.dest_node);
          if(n != undefined){
            dst.push(n.lid)
          }
        });

      }
      else {
        dst = dst.concat( fdata.nodes.selectedRight.map(n => n.lid) );
      }
    }
  }

  // --- link based
  else {

    if (fdata.links.selectedLeft.length > 0) {
      src = src.concat( fdata.links.selectedLeft.map(n => n.nodefrom) );
    }
    if (fdata.links.selectedRight.length > 0) {
      dst = dst.concat( fdata.links.selectedRight.map(n => n.nodeto.lid) );
    }
  }

  //console.log('sd', src.length, dst.length)
  // if both src and dst are zero, simply return the job routes
  if (src.length == 0 && dst.length == 0){
    publish('route_found', jobs_routes);
    return;
  }

  // -------------------------------------------------------------

  if (dst.length == 0) {

    // use all job dests as destinations
    if (switchbased) {
      dst = jobs_routes.dlids;
    }

    // get all possible destinations of this link
    // if jobs are available, intersect the destinations
    if (linkbased) {
      fdata.links.selectedLeft.forEach(lnk => {
        dst = dst.concat( dlids4link(lnk, 1) );
      });
      console.log(' Using', dst.length, 'destinations for selected link');
      if (jobs_routes.dlids.length != 0) {
        dst = dst.filter(n => jobs_routes.dlids.includes(n));
        console.log(' Restricting to', dst.length, 'for selected jobs');
      }
    }
  }

  if(src.length == 0) {

    if (switchbased) {
      src = jobs_routes.dlids;
    }

    if (linkbased) {
      fdata.links.selectedRight.forEach(lnk => {
        src = src.concat( dlids4link(lnk, -1) );
      });
      console.log(' Using', src.length, 'sources for selected link');
      if (jobs_routes.dlids.length != 0) {
        src = src.filter(n => jobs_routes.dlids.includes(n));
        console.log(' Restricting to', src.length, 'for selected jobs');
      }
    }

    src = src.map(n => Topology.node_or_switch_by_lid(n));
  }

  // --------------------------------------------------------
  // --------------------------------------------------------


  // -------------------------------------------------------------
  // now find routes

  src = Array.from(new Set(src));
  dst = Array.from(new Set(dst));
  console.log(' finding route for', src.length, 'sources and', dst.length, 'destinations')

  src.forEach(s => {  dst.forEach(d => {  find_route(s, d, troutes)  }) })

  troutes.dlids = dst;
  troutes.nodes = Array.from(troutes.nodes);
  troutes.links = Array.from(troutes.links);

  console.log(' found route {', troutes.dlids.length, troutes.nodes.length, troutes.links.length, '}')
  publish('route_found', troutes);
}

/* -------------------------------------------------------------------------- */
function init(){

  let d = d3.select("#divdata");
  let id = d.append('div').attr('class', 'inputDiv');

  id.append('label').text('Routing Tables: ');
  dropdown = id.append("select")
              .attr("id", 'selectroutingtstamp')
              .on("change", function(d) {
                select_time( dropdown.property("value") );
              });

  subscribe('routes_toberead', function(channel, data){

    let readPromises = [];
    window.astatus('reading', data.files.length, 'rtable files')
    logger.log(' Reading', data.files.length, 'rtable files')
    data.files.forEach(function(f, i){
      readPromises.push(load(f.tstamp, data.url+'/'+f.fname));
    })

    Promise.all(readPromises)
      .then(() => {
        window.astatus('read', data.files.length, 'rtable files')
        data.files.sort(function(a, b) {
          return d3.ascending(a.tstamp, b.tstamp);
        });

        dropdown.selectAll('option')
          .data(data.files)
          .enter()
          .append("option")
          .text(d => date2string_fileTable(d.tstamp))
          .attr("value", d =>  date2string_fileTable(d.tstamp))
          .property("selected", (d, i) => (i == 0))

        select_time( date2string_fileTable(data.files[0].tstamp) );
      });
  });


  subscribe('fattree_components_selected', function(channel, data) {
    fattree_components_selected(data);
  });
  subscribe('jobs_selected', function(channel, data) {
    jobs_selected(data);
  });
}

// -----------------------------------------------------------------------------
/*
function is_empty(routes){
  return routes.nodes.length == 0 && routes.links.length == 0;
}
function intersect(routes1, routes2) {

  console.log('intersecting routes: {', routes1.nodes.length, routes1.links.length, '}',
                                   '{', routes2.nodes.length, routes2.links.length, '}')

  let nodes = [];
  let links = [];

  if (is_empty(routes1)){
    nodes = routes2.nodes.map(n => n);
    links = routes2.links.map(n => n);

    return {nodes: nodes, links: links};
  }
  if (is_empty(routes2)){
    nodes = routes1.nodes.map(n => n);
    links = routes1.links.map(n => n);

    return {nodes: nodes, links: links};
  }

  nodes = routes1.nodes.map(n => n);
  links = routes1.links.map(n => n);

  nodes = nodes.filter(n => routes2.nodes.includes(n))
  links = links.filter(n => routes2.links.includes(n))

  console.log('found intersection: {', nodes.length, links.length, '}')
  return {nodes: nodes, links: links};
}

function publish_route(routes) {

  routes.links = linkids2links(routes.links);
  publish('route_found', routes);
}


function linkids2links(linkids) {

  return linkids.map( d => {
    let s = d.split('-');
    return {
      from: Topology.node_or_switch_by_id(s[0]),
      to:   Topology.node_or_switch_by_id(s[1])
    };
  });
}
*/
/*
function extend(a, b) {
  Array.prototype.push.apply(a, b);
}

function follow(node, lid) {

  let path = [];
  if (node.lvl == 0)
    node = node.ports[0];

  while (node.lid != lid) {
    node = node.ports[node.lids.get(lid)];
    path.push(node.lid)
  }
  return path;
}

function backward(node, lid, path) {

  let paths = [];
  for (let neighbor of node.ports)  {
    if (!neighbor)
      continue;
    if (neighbor.lvl > 0) {
      if (neighbor.lids.has(lid) && neighbor.ports[neighbor.lids.get(lid)]  == node)  {
        extend( paths, backward(neighbor, lid, [node.lid].concat(path)));
      }
    } else if (neighbor.lid != lid && paths.length == 0) {
      paths = [ [node.lid].concat(path) ];
    }
  }
  return paths;
}

function forward_routes(node, through_lid) {

  let paths = [];
  for (let lid of node.lids.keys()) {
    if (lids.get(lid).lvl == 0) {
      let path = follow(node, lid);
      if (path.indexOf(through_lid) != -1)
        paths.push(path);
    }
  }
  return paths;
}

function routes_between(node, target_lid) {

  let paths = [];
  for (let path of forward_routes(node, target_lid)) {
    let dlid = path[path.length-1];
    extend(paths, backward(node, dlid, path));
  }
  return paths;
}

function routes_through(node) {

  let paths = [];
  if (node.lvl == 0) {
    let sw = node.ports[0];
    for (let lid in sw.lids.keys()) {
      if (lids.get(lid).lvl == 0 && lid != node.lid) {
        paths.push(follow(sw, lid));
      }
    }
  } else {
    for (let lid of node.lids.keys()) {
      if (lids.get(lid).lvl == 0)
        extend(paths, backward(node, lid, follow(node, lid)));
    }
  }
  return paths;
}
*/

/*
function find_route(src, dst, nodes, links) {

  let ts = Array.from(data.keys());
  activertable = data.get(ts[0])

  if (activertable == undefined){
    console.log('activertable not found')
    return;
  }

  if (src == dst) {
    nodes.push(src)
    return;
  }

  let curr_node = src;
  let next_node = null;

  nodes.push(curr_node);

  while(curr_node.lid != dst.lid) {

    let swtch = activertable.get(curr_node.id);
    if (swtch == undefined)
      break;

    let port_num = swtch.lidmap.get(dst.lid);

    let port = curr_node.ports[port_num-1]
    if (port == undefined)
      break;
    let dnode = port.dest_node;
    if (dnode == undefined)
      break;

    next_node = Topology.node_or_switch_by_id(dnode);

    // no need to go down to the endnode!
    if (next_node.lvl == 0)
      break;

    nodes.push(next_node);
    links.push( curr_node.id + '-' + next_node.id );

    curr_node = next_node;
  }
}*/
/*
// find routes between a set of srcs and a set of dsts
function find_routes(srcs, dsts, routes) {

  let ssrcs = Array.from(new Set(srcs));
  let sdsts = Array.from(new Set(dsts));

  console.log(' find_route(', ssrcs.length, ',', sdsts.length, ')')

  ssrcs.forEach(s => {
  sdsts.forEach(d => {
    find_route(s, d, routes.nodes, routes.links)
  })
  });

  routes.dests = sdsts.map(n => n.lid);
  routes.nodes = Array.from(new Set(routes.nodes));
  routes.links = Array.from(new Set(routes.links));

  console.log(' found route {', routes.dests.length, routes.nodes.length, routes.links.length, '}')
}


function setintersect(seta,setb) {

  //console.log('setintersect', seta, setb)

  let seti = Array.from(new Set(seta));
  for(let n of seti) {
    if(setb.includes(n))
      return true;
  }
  return false;
}

*/

/* -------------------------------------------------------------------------- */
export default {

  init() {      return init();  },
  load(_) {     return load(_);  }
}
/* -------------------------------------------------------------------------- */

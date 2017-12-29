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
import * as chromatic from 'd3-scale-chromatic';

import {publish, subscribe} from '../utils/pubsub.js';
import {colorbarV, colorbarH} from '../component/colorbar';
import CMap from '../component/colormap';

import Counters from '../model/counters';
import Topology from '../model/topology';
import Routing from '../modules/routing';
import FatPod from '../fattree/fatpod';
import * as Layout from '../fattree/layout';


// ---------------------------------------------------------------------
// color map management for links and switches
// ---------------------------------------------------------------------

// no need to edit these.
// blue-yellow-red
const COLORMAP_BYR = ["#4575b4","#74add1","#abd9e9","#e0f3f8","#ffffbf","#fee090","#fdae61","#f46d43","#d73027"];

// brown-gray-green
const COLORMAP_BGG = ['#8c510a','#bf812d','#dfc27d','#f6e8c3','#f5f5f5','#c7eae5','#80cdc1','#35978f','#01665e'];

// purple-white-green
const COLORMAP_PWG = ['#762a83','#9970ab','#c2a5cf','#e7d4e8','#f7f7f7','#d9f0d3','#a6dba0','#5aae61','#1b7837'];

// brown-white-purple
const COLORMAP_BWP = ['#b35806','#e08214','#fdb863','#fee0b6','#f7f7f7','#d8daeb','#b2abd2','#8073ac','#542788'];


let cmap_links = { up: undefined, down: undefined };
let cmap_switches = { in: undefined, out: undefined };
let cscales_links = { up: undefined, down: undefined };
let cscales_switches = { in: undefined, out: undefined };

// this variable defines how many colormaps we will use
  // 4: separate color maps for up/down links, and in/out switches
  // 3: separate color maps for up/down links, but a single color map for switches
  // 2: one color map for links, and one for switches
  // 1: single color map for everything

let ncolormaps = 3;

//TODO: manual choice of colormaps
// which type of color map to use
let cmap_type = 'singlehue';
//let cmap_type = 'diverging';

// edit the following for more colormaps maps
    // more choices at: https://github.com/d3/d3-scale-chromatic
    // and http://colorbrewer2.org/#type=diverging
if (cmap_type == 'singlehue') {
  cmap_links = {      down:   d3.scaleSequential(chromatic.interpolateGreens),
                      up: d3.scaleSequential(chromatic.interpolateOranges)
               };
  cmap_switches = {   in:   d3.scaleSequential(chromatic.interpolatePurples),
                      out:  d3.scaleLinear().range(['white', 'rgb(231,41,138)'])
                  };
}
else if (cmap_type == 'diverging') {
  cmap_links = {      up:   CMap().colors(COLORMAP_BYR),
                      down: CMap().colors(COLORMAP_BGG) };
  cmap_switches = {   in:   CMap().colors(COLORMAP_PWG),
                      out:  CMap().colors(COLORMAP_BWP) };
}

// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------

let show_mean = (cmap_type == 'diverging');
let cscales = [];
let job_colors = new Map();

//let lvl_colors = ['dimgray', '#D4A190', '#C390D4', '#A1D490'];
let lvl_colors = ['dimgray',
'#e41a1c', 'dimgray', '#1f78b4', '#993404', '#984ea3',  '#1b9e77', '#d95f02', '#7570b3',
'#7570b3', '#1b9e77', '#d95f02',
'rgb(117,112,179)', 'seagreen',  'rgb(217,95,2)', 'crimson', 'dimgray', '#D4A190', '#C390D4', '#A1D490', 'seagreen'];
//let cmap_switches = ['black', 'black', '#000', '#000'];
//let cmap_switches = ['black', 'dimgray', 'dimgray', 'dimgray'];
//let cmap_switches = ['black', '#ddd', '#ddd', '#ddd'];
//let cmap_switches = ['black', '#D4A190', '#C390D4', '#A1D490', 'seagreen'];
//let lvl_colors = ['black', 'crimson', 'seagreen', 'dimgray', '#D4A190', '#C390D4', '#A1D490', 'seagreen'];

function init_colormaps() {

  let d = d3.select("#divfattree");

  let id = d.append('div').attr('class', 'inputDiv');

  if(show_mean){
      id.append('text').text('Force colorscale [min, mid, max]');
    }
  else {
    id.append('text').text('Force colorscale [min, max]');
  }
      id.append('input').attr('type', 'checkbox')
        .attr('id', 'cscale_force')
        .on('change', update);

  id = d.append('div').attr('class', 'inputDiv')
        .style('padding-right', '30px')
        .style('float', 'right');

      id.append('input').attr('type', 'number')
        .attr('id', 'cscale_min').on('change', update)
        .attr('value', '0');

  if (show_mean) {
      id.append('label').text(' , ');
      id.append('input').attr('type', 'number')
        .classed('wide', true)
        .attr('id', 'cscale_mid').on('change', update)
        .attr('value', '0')
    }

      id.append('label').text(' , ');
      id.append('input').attr('type', 'number')
        .classed('wide', true)
        .attr('id', 'cscale_max').on('change', update)
        .attr('value', '0');

      id.append('label').text('   ');

  let cd = id.append('select')
             .attr('id', 'cscale_unit').on('change', update);
      cd.append('option').attr('value', 1).text(' ');
      cd.append('option').attr('value', Math.pow(10,3)).text('k');
      cd.append('option').attr('value', Math.pow(10,6)).text('M');
      cd.append('option').attr('value', Math.pow(10,9)).text('G');
      cd.append('option').attr('value', Math.pow(10,12)).text('T');
      cd.append('option').attr('value', Math.pow(10,15)).text('P');
      cd.append('option').attr('value', -1).text('-');


  // color scales
  if (ncolormaps == 1) {

    cmap_links.down = cmap_links.up;
    cmap_switches.in = cmap_links.up;
    cmap_switches.out = cmap_links.up;

    cscales.push (colorbarH(cmap_links.up, true, show_mean));
    d.call(cscales[0]);
  }
  else if (ncolormaps == 2) {

    cmap_links.down = cmap_links.up;
    cmap_switches.out = cmap_switches.in;

    cscales.push (colorbarH(cmap_links.up, true, show_mean));
    cscales.push (colorbarH(cmap_switches.in, true, show_mean));

    d.call(cscales[0]);
    d.call(cscales[1]);
  }
  else if (ncolormaps == 3) {

    cmap_switches.out = cmap_switches.in;

    cscales.push (colorbarH(cmap_links.up, true, show_mean));
    cscales.push (colorbarH(cmap_links.down, true, show_mean));
    cscales.push (colorbarH(cmap_switches.in, true, show_mean));

    d.call(cscales[0]);
    d.call(cscales[1]);
    d.call(cscales[2]);
  }
  else if (ncolormaps == 4) {

    cscales.push (colorbarH(cmap_links.up, true, show_mean));
    cscales.push (colorbarH(cmap_links.down, true, show_mean));
    cscales.push (colorbarH(cmap_switches.in, true, show_mean));
    cscales.push (colorbarH(cmap_switches.out, true, show_mean));

    d.call(cscales[0]);
    d.call(cscales[1]);
    d.call(cscales[2]);
    d.call(cscales[3]);
  }
}

function unformat(n) {

  let p = d3.format(".4s")(n);
  let u = p[ p.length-1 ];

  let factor = 1;
  switch(u) {
    case 'k':   factor = Math.pow(10,3);  break;
    case 'M':   factor = Math.pow(10,6);  break;
    case 'G':   factor = Math.pow(10,9);  break;
    case 'T':   factor = Math.pow(10,12);  break;
    case 'P':   factor = Math.pow(10,15);  break;
  }

  return !isNaN (parseInt(u)) ? { v: parseFloat(p), unit: ' ', factor: factor } :
                                { v: parseFloat( p.substring(0,p.length-1) ), unit: u, factor: factor };
}

function set_vrange_toui(range) {

  let midx = range.length-1;
  let mformat = unformat(range[midx]);

  let dropdown = document.getElementById('cscale_unit');
  let options = dropdown.getElementsByTagName('option');

  for (var i = 0; i < options.length-1; i++) {
     if (options[i].text == mformat.unit) {
        dropdown.selectedIndex = i;
        break;
    }
  }

  document.getElementById("cscale_min").value = range[0] / mformat.factor;
  document.getElementById("cscale_max").value = range[midx] / mformat.factor;

  if(show_mean)
    document.getElementById("cscale_mid").value = range[1] / mformat.factor;
}

function get_vrange_fromui() {

  let range = [0,0];

  let dropdown = document.getElementById('cscale_unit');
  let options = dropdown.getElementsByTagName('option');

  let mu = +options[dropdown.selectedIndex].value;

  range[0] = +document.getElementById("cscale_min").value * mu;
  range[1] = +document.getElementById("cscale_max").value * mu;

  if(show_mean){
    let mid = +document.getElementById("cscale_mid").value * mu;

    if (mid < range[0]){
      mid = range[0];
      document.getElementById("cscale_mid").value = document.getElementById("cscale_min").value;
    }
    if (mid > range[1]){
      mid = range[1];
      document.getElementById("cscale_mid").value = document.getElementById("cscale_max").value;
    }
    range = [range[0], mid, range[1]];
  }

  return range;
}

function update_colormaps(links, switches) {

  let forcescale = document.getElementById("cscale_force").checked;

  let range_links = [0, 0];
  let range_switches = [0, 0];

  // -----------------------------------------------------------
  if (forcescale) {
    let range_ui = get_vrange_fromui();
    range_links = range_ui;
    range_switches = range_ui;
  }
  else {
    range_links[1] = d3.max(links, d => d.rcv_data);

    // get range of switches
    let inmax = d3.max(switches, d => d.in_data.max);
    let outmax = d3.max(switches, d => d.out_data.max);

    range_switches[1] = (inmax > outmax) ? inmax : outmax;

    let range_ui = (range_switches[1] > range_links[1]) ? range_switches : range_links;

    if (show_mean) {

      range_links = [range_links[0], 0.5*(range_links[0] + range_links[1]), range_links[1]];
      range_switches = [range_switches[0], 0.5*(range_switches[0] + range_switches[1]), range_switches[1]];
      range_ui = [range_ui[0], 0.5*(range_ui[0] + range_ui[1]), range_ui[1]];
    }

    let meanlink = d3.mean(links, d => d.rcv_data);
    /*
    let meanin = d3.mean(switches, d => d.in_data.max);
    let meanout = d3.mean(switches, d => d.out_data.max);
    let meansw = (meanin*d.in_data.vals.length + meanout*d.outdata.vals.length) / (d.indata.vals.length + d.outdata.vals.length);
    */
    console.log('\n\n *** mean (links) =', prefixformat(meanlink), '*** \n\n');
    set_vrange_toui( range_ui );
  }

  // -----------------------------------------------------------

  cmap_links.up.domain( range_links );
  cmap_links.down.domain( range_links );
  cmap_switches.in.domain( range_switches );
  cmap_switches.out.domain( range_switches );

  if (ncolormaps == 1) {
    cscales[0].scale(cmap_links.up)
  }
  else if (ncolormaps == 2) {
    cscales[0].scale(cmap_links.up)
    cscales[1].scale(cmap_switches.in)
  }
  else if (ncolormaps == 3) {
    cscales[0].scale(cmap_links.up)
    cscales[1].scale(cmap_links.down)
    cscales[2].scale(cmap_switches.in)
  }
  else if (ncolormaps == 4) {
    cscales[0].scale(cmap_links.up)
    cscales[1].scale(cmap_links.down)
    cscales[2].scale(cmap_switches.in)
    cscales[3].scale(cmap_switches.out)
  }
}

// ---------------------------------------------------------------------
// ---------------------------------------------------------------------

let prefixformat = d3.format(".4s");
let commaformat = d3.format(",.0f");

let pods = [];
let switches = [],
    links = [];

let selected_links = { selectedLeft: [], selectedRight: [] };
let selected_nodes = { selectedLeft: [], selectedRight: [] };

// -----------------------------------------------
// UI options

function linkdir_changed() {
  let btype = document.querySelector('input[name=linkdir]:checked').value;
  for(let podId in pods){
    pods[podId].set_dir(btype);
  }
}
function layout_changed() {
  let ltype = document.querySelector('input[name=layout]:checked').value;
  Layout.set_type(ltype);
  for(let podId in pods){
    pods[podId].update(true);
  }
}
function pixsize_changed() {
  let lsize = +document.querySelector('input[name=pixsz]').value;
  Layout.set_pixsz(lsize);
  for(let podId in pods){
    pods[podId].update(true);
  }
}

function update_labelselection() {

  d3.select('#labelselection')
  .text('Selection: [' + selected_nodes.selectedLeft.length + ',' + selected_nodes.selectedRight.length + '] sw., ['
                       + selected_links.selectedLeft.length + ',' + selected_links.selectedRight.length + '] lnk.');
}

function switchid(s) {  return '[' + s.node.id + ']';                                 }
function linkid(l) {    return '[' + l.nodefrom.id + '[' + l.port_idx + '] \u2192 ' +
                                     l.nodeto.id + '[' + l.portto + '] ]';  }

function object_mouseover(d) {

  if (d == undefined) {     window.atooltip();  return; }
  let c = d.component;
  if (d.type == 'switch'){
    window.atooltip( ('L'+ c.node.lvl), d.type, switchid(c),
                        'sum(in_data) =', prefixformat(c.in_data.sum),
                        ', sum(out_data) =', prefixformat(c.out_data.sum) );
  }
  else if (d.type == 'link'){
    window.atooltip(d.type, linkid(c), 'rcv_data =', prefixformat(c.rcv_data))
  }
}

function object_clicked(object) {

  logger.info(object)

  let llist = (object.type == 'switch') ? selected_nodes[object.mode_lr] :
              (object.type == 'link')   ? selected_links[object.mode_lr] :
              [];


  let exists = (undefined != llist.find(d => (d == object.component)));


  // clear everything
  if (object.type == 'switch') {
    selected_links.selectedLeft = [];
    selected_links.selectedRight = [];
  }
  else if (object.type == 'link') {
    selected_nodes.selectedLeft = [];
    selected_nodes.selectedRight = [];
  }

  if(exists) {
    llist = llist.filter(d => d != object.component);
    window.astatus('deselected', object.type, object.component.id);
  }
  /*
  else if (object.mode_mselect) {
    llist.push( object.component );
    window.astatus('selected', object.type, object.component.id);
  }
  */
  else {
    llist = [object.component];
    window.astatus('selected', object.type, object.component.id);
  }

  if (object.type == 'switch') {      selected_nodes[object.mode_lr] = llist; }
  else if (object.type == 'link') {   selected_links[object.mode_lr] = llist; }

  update_selection();
}

function clearSelection() {

  selected_links = { selectedLeft: [], selectedRight: [] };
  selected_nodes = { selectedLeft: [], selectedRight: [] };

  update_selection();
  window.astatus('cleared fat-tree selection')
}

// -----------------------------------------------
function update_selection() {

  for(let podId in pods){

    pods[podId].select_switches(selected_nodes)
               .select_links(selected_links)
               .update(false);
  }
  update_labelselection();
  publish('fattree_components_selected', {nodes: selected_nodes, links: selected_links});
}

function render_route(route) {

  let links = [];

  if(route.links.length > 0) {
    links = route.links.map(l => {
                          let toks = l.split('-');
                          return {  from: +toks[0], to: +toks[1]  };
                  });
  }
  for(let podId in pods){

    pods[podId].highlight_switches(route.nodes)
               .highlight_links(links)
               .update(false);
  }
}

// -----------------------------------------------

function update(data) {

  logger.log('\nFatTree.update(', data, ')');

  if (data != undefined) {

    let nswitches = data.switches.length;
    let nlinks = data.counters.length;

    // dont need compute nodes
    switches = data.switches.filter(d => d.node.lvl != 0);
    if( nswitches != switches.length) {
      logger.log('   Filtered', (nswitches-switches.length), 'compute nodes');
      nswitches = switches.length;
    }

    // remove invalid links
    links = data.counters.filter( d => (d.nodefrom != null && d.nodeto != null) );
    if( nlinks != links.length) {
      logger.log('   Filtered', (nlinks-links.length), 'invalid links');
      nlinks = links.length;
    }

    // remove 0--1 links
    links = links.filter( d => (d.nodefrom.lvl != 0 && d.nodeto.lvl != 0) );
    if( nlinks != links.length) {
      logger.log('   Filtered', (nlinks-links.length), '0--1 links');
      nlinks = links.length;
    }

    // filter links based on histogram brush range
    if(data.type == "inclusive") {
      links = links.filter( d => (d.rcv_data >= data.valrange[0] && d.rcv_data <= data.valrange[1]) );
    }
    else {
      links = links.filter( d => (d.rcv_data < data.valrange[0] || d.rcv_data > data.valrange[1]) );
    }
    if( nlinks != links.length) {
      logger.log('   Filtered(brushed[',data.valrange[0],',',data.valrange[1],'], ', data.type, ') from', nlinks, 'to', links.length);
      nlinks = links.length;
    }
  }

  update_colormaps(links, switches);

  for(let podId in pods){

    let pswitches = switches.filter(d => (d.node.pod == podId || d.node.lvl == 3));
    let plinks = links.filter(d => (d.nodefrom.pod == podId || d.nodeto.pod == podId));

    pods[podId].colormap_links(cmap_links)
               .colormap_switches(cmap_switches)
               .switches(pswitches)
               .links(plinks)
               .update(true);
  }
}

function jobs_selected(data) {

  console.log('fattree.job_selected', data)
  if (data.jobs.length == 0) {
    for(let podId in pods){
      pods[podId].switchcolormode('counters')
                 .update(true);
    }
    document.getElementById('switchcoloring').selectedIndex = 0;
    return;
  }

  let l1nodes = [];

  if (data.jobs.length > 0){

    // compute the union set for l1 and l0
    data.jobs.forEach( (job, i) => {
      l1nodes = l1nodes.concat( job._l1.map(n => (
        {id: n.id, jobid: job.id, ncount: n.count,
        col: data.colors[i]}
      )));
    });
  }

  for(let podId in pods){
    pods[podId].switchcolormode('jobs')
               .jobl1(l1nodes, Topology.L1L0())
               .update(true);
  }

  document.getElementById('switchcoloring').selectedIndex = 1;
}
// -----------------------------------------------

function init() {

  logger.log('FatTree.init()');

  // -----------------------------------------------------------------
  let d = d3.select("#divfattree");
  d.append('h3').text('Fat-Tree');

  let indiv = d.append('div').attr('class', 'inputDiv');
  indiv.append('button').text('Clear')
       .on('click', clearSelection);
  indiv.append('label').attr('id', 'labelselection');
  update_labelselection();

  // add radio buttons for linkdir
  indiv = d.append('div').attr('class', 'inputDiv');
  indiv.append('label').text('Link Direction: ');
  indiv.append('input').attr('type', 'radio').attr('name', 'linkdir').attr('value', 'up')
       .on('change', linkdir_changed);
  indiv.append('text').text('up');
  indiv.append('input').attr('type', 'radio').attr('name', 'linkdir').attr('value', 'down')
       .on('change', linkdir_changed);
  indiv.append('text').text('down');
  indiv.append('input').attr('type', 'radio').attr('name', 'linkdir').attr('value', 'both')
       .on('change', linkdir_changed)
       .property("checked", "true");
  indiv.append('text').text('both');

  // add radio buttons for layout
  indiv = d.append('div').attr('class', 'inputDiv');
  indiv.append('label').text('Layout: ');
  indiv.append('input').attr('type', 'radio').attr('name', 'layout').attr('value', 'blocked')
       .on('change', layout_changed)
       .property("checked", "true");
  indiv.append('text').text('blocked');
  indiv.append('input').attr('type', 'radio').attr('name', 'layout').attr('value', 'interleaved')
       .on('change', layout_changed);
  indiv.append('text').text('interleaved');

  // switch color map
  indiv = d.append('div').attr('class', 'inputDiv')
           .on('mouseover', d => window.atooltip('change coloring mode for switches'))
           .on('mouseout', d => window.atooltip())

  indiv.append('label').text('Switch Coloring: ');
  let dropdown = indiv.append("select")
              .attr("id", 'switchcoloring')
              .on("change", function(d) {
                    let id = dropdown.property("value");
                    for(let pod of pods){
                      pod.switchcolormode(id)
                         .update(true);
                    }
              });
  dropdown.append('option').text('counters').attr('value', 'counters');
  dropdown.append('option').text('levels').attr('value', 'levels');
  dropdown.append('option').text('jobs').attr('value', 'jobs');

  // add range input for pixel size
  indiv = d.append('div').attr('class', 'inputDiv');
  indiv.append('label').text('Link Size: ');
  indiv.append('input').attr('type', 'range').attr('name', 'pixsz')
       .on('change', pixsize_changed)
       .attr('min', '5').attr('max', '15').attr('value', '7');


  init_colormaps();

  // -----------------------------------------------------------------
  //Layout.set_dir('both');
  Layout.set_type('blocked');
  Layout.set_pixsz(7);

  let torigin = { x: 0, y: 0 };
  let tsize = { w: 1000, h: 700 };

  let selection = d3.select('#fattree');

  subscribe('topology_updated', function(channel, data) {

    //logger.log('FatTree.received: topology_updated(', data, ')')
    for(let podId = 0; podId < data.num_pods; podId++){
      let pod = FatPod('pod ' + podId)
            .on('mouseover', object_mouseover)
            .on('selected', object_clicked)
            .switchcolors(lvl_colors)
            .switchcolormode(dropdown.property('value'));


      pods.push(pod);
      selection.call(pod);
    }
    //logger.log('FatTree: Created ' + pods.length + ' pods');
  });

  subscribe('histogram_brushed', function(channel, data) {  update(data); });
  subscribe('route_found', function(channel, data){   render_route(data); });
  subscribe('jobs_selected', function(channel, data){ jobs_selected(data); });
}

// -----------------------------------------------

export default {
  init() {                    return init();                }
}

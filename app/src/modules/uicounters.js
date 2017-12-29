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
import {publish, subscribe} from '../utils/pubsub.js'
import Legend from '../component/legend';

/* -------------------------------------------------------------------------- */
const dateFormat_ui = d3.timeFormat('%Y.%m.%d %H:%M:%S'); // time to string
let dropdown = null;
let legend = null;

let summaryInfo = [
  { label: '0 \u2192 1', cls: 'q0-3'},
  { label: '1 \u2192 0', cls: 'q3-3'},
  { label: '1 \u2192 2', cls: 'q1-3'},
  { label: '2 \u2192 1', cls: 'q4-3'},
  { label: '2 \u2192 3', cls: 'q2-3'},
  { label: '3 \u2192 2', cls: 'q5-3'},

  { label: '0 \u2194 1', cls: 'q0-3'},
  { label: '1 \u2194 2', cls: 'q1-3'},
  { label: '2 \u2194 3', cls: 'q2-3'},

  { label: 'up', cls: 'q0-2'},
  { label: 'down', cls: 'q1-2'},

  { label: 'all', cls: 'q0-1'}
];

/* -------------------------------------------------------------------------- */

function add_files(filesList) {

  filesList.sort(function(a, b) {
    return d3.ascending(a.tstamp, b.tstamp);
  });

  dropdown.selectAll('option')
    .data(filesList)
    .enter()
    .append("option")
    .text(d => dateFormat_ui(d.tstamp))
    .attr("value", d => d.fname)

  if (filesList.length > 1) {
    dropdown.append('option')
      .text('multiple')
      .attr('value', 'multiple');
  }
}

function select_file(timerange) {

  let selectElement = document.getElementById('selecttstamp');
  let options = selectElement.getElementsByTagName('option');
  let noptions = options.length;

  if (timerange == undefined){
    selectElement.selectedIndex = noptions-1;
    return;
  }
  if (timerange[0] != timerange[1]) {
    selectElement.selectedIndex = noptions-1;
    return;
  }

  let v = dateFormat_ui(timerange[0]);
  for (var i = 0; i < noptions-1; i++) {
    if (options[i].text == v) {
        selectElement.selectedIndex = i;
        break;
    }
  }
}

/* -------------------------------------------------------------------------- */

function update_legend() {

  let show_byLvl = document.querySelector('input[name=summarybylvl]').checked;
  let show_byDir = document.querySelector('input[name=summarybydir]').checked;

  let entries = [];

  if (show_byDir && show_byLvl) {
    entries = summaryInfo.filter( d => d.label.includes('\u2192'));
  }
  else if (show_byLvl) {
    entries = summaryInfo.filter( d => d.label.includes('\u2194'));
  }
  else if (show_byDir) {
    entries = summaryInfo.filter( d => d.label.includes('up') || d.label.includes('down'));
  }
  else {
    entries = summaryInfo.filter( d => d.label.includes('all'));
  }
  legend.data(entries)
}

function legend_mouseover(d) {
  if(d == undefined) {
    window.atooltip()
    return
  }
  window.atooltip('color', d.col, 'used for curve', d.label)
}

/* -------------------------------------------------------------------------- */
// init
function init() {

  logger.log('UI.init()');

  // --------------------------------------------------
  let d = d3.select("#divdata");
  d.append('h3').text('Data');

  let id = d.append('div').attr('class', 'inputDiv')
    .on('mouseover', d => window.atooltip('select counter for a particular time-stamp'))
    .on('mouseout', d => window.atooltip())

  id.append('label').text('Time Stamps: ');
  dropdown = id.append("select")
              .attr("id", 'selecttstamp')
              .on("change", function(d) {
                    let id = dropdown.property("value");
                    if (id != 'multiple')
                      publish('file_selected', {filename: id});
              })

  id = d.append('div').attr('class', 'inputDiv')
  id.append('label').text('Counters: ');
  let ld = id.append('select')
  ld.append('option').attr('name', 'data_sent').text('data_sent')

  // --------------------------------------------------
  d = d3.select("#divsummary");
  d.append('h3').text('Summary');

  id = d.append('div').attr('class', 'inputDiv')
    .on('mouseover', d => window.atooltip('group summary by level and direction'))
    .on('mouseout', d => window.atooltip())

  id.append('label').text('Group by: ');

  id.append('input').attr('type', 'checkbox').attr('name', 'summarybylvl').attr('value', 'level')
    .on('change', function() {
      //logger.log('\nSummary.publish: summarylvl_changed');
      publish('summarylvl_changed', {});
      update_legend();
    })
    .property("checked", "true");
  id.append('text').text('level');

  id.append('input').attr('type', 'checkbox').attr('name', 'summarybydir').attr('value', 'direction')
    .on('change', function() {
      publish('summarydir_changed', {});
      update_legend();
    })
    .property("checked", "true");
  id.append('text').text('direction');

  // --------------------------------------------------

  legend = Legend()
  d.call(legend);
  update_legend();

  // --------------------------------------------------
  subscribe('directoryListing_updated', function(channel, data) {
    add_files(data);
  });

  subscribe('timerange_updated', function(channel, data) {
    select_file(data.timerange);
  });
}

/* -------------------------------------------------------------------------- */
export default {
  init() {   return init()  },
  summaryInfo() {   return summaryInfo; }
}

/* -------------------------------------------------------------------------- */

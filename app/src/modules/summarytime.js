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

// This module deals with time summary
    // fetches data from Counters to creates summary
    // handles summary-based ui
    // displays summary plot

import * as d3 from 'd3';
import {publish, subscribe} from '../utils/pubsub.js'

import TimeChart from '../component/timechart.js';
import Model from '../model/model';
import Topology from '../model/topology';
import Counters from '../model/counters';

import UI from './uicounters.js'

/* -------------------------------------------------------------------------- */
// TODO: this is duplicated from UI. should remove redundancy
const dateFormat_ui = d3.timeFormat('%Y.%m.%d %H:%M:%S'); // time to string

let timeSummaryChart = null;

let timeSteps = [];
let summary = [
  {type: 'max', l0: 0, l1: 1, dir: 'up', values: []},     // 0
  {type: 'max', l0: 0, l1: 1, dir: 'down', values: []},   // 1
  {type: 'max', l0: 0, l1: 1, dir: 'both', values: []},   // 2

  {type: 'max', l0: 1, l1: 2, dir: 'up', values: []},     // 3
  {type: 'max', l0: 1, l1: 2, dir: 'down', values: []},   // 4
  {type: 'max', l0: 1, l1: 2, dir: 'both', values: []},   // 5

  {type: 'max', l0: 2, l1: 3, dir: 'up', values: []},     // 6
  {type: 'max', l0: 2, l1: 3, dir: 'down', values: []},   // 7
  {type: 'max', l0: 2, l1: 3, dir: 'both', values: []},   // 8

  {type: 'max', l0: 'any', l1: 'any', dir: 'up', values: []},   // 9
  {type: 'max', l0: 'any', l1: 'any', dir: 'down', values: []}, // 10
  {type: 'max', l0: 'any', l1: 'any', dir: 'both', values: []}, // 11

  {type: 'mean', l0: 0, l1: 1, dir: 'up', values: []},     // 12
  {type: 'mean', l0: 0, l1: 1, dir: 'down', values: []},   // 13
  {type: 'mean', l0: 0, l1: 1, dir: 'both', values: []},   // 14

  {type: 'mean', l0: 1, l1: 2, dir: 'up', values: []},     // 15
  {type: 'mean', l0: 1, l1: 2, dir: 'down', values: []},   // 16
  {type: 'mean', l0: 1, l1: 2, dir: 'both', values: []},   // 17

  {type: 'mean', l0: 2, l1: 3, dir: 'up', values: []},     // 18
  {type: 'mean', l0: 2, l1: 3, dir: 'down', values: []},   // 19
  {type: 'mean', l0: 2, l1: 3, dir: 'both', values: []},   // 20

  {type: 'mean', l0: 'any', l1: 'any', dir: 'up', values: []},  // 21
  {type: 'mean', l0: 'any', l1: 'any', dir: 'down', values: []},// 22
  {type: 'mean', l0: 'any', l1: 'any', dir: 'both', values: []} // 23
];

/* -------------------------------------------------------------------------- */

function compute(data) {

  logger.log('TimeSummary.compute()');
  data.forEach(function(counters, tstamp) {

    //logger.log(tstamp)
    //logger.log(counters.length)

    // this has the same ordering as summary
    let vals = [
      [], [], [], [], [], [],
      [], [], [], [], [], []
    ];

    counters.forEach( function(d) {

      let snode = Topology.node_or_switch_by_id(d.node_id);
      //console.log(d)
      if(snode == undefined) {
        console.error('TimeSummary.compute() could not find snode for id', d.node_id)
        return;
      }
      //console.log(snode)
      let dnodeid = snode.ports[d.port_idx-1].dest_node;
      if(dnodeid == "")
        return;

      let dnode = Topology.node_or_switch_by_id(dnodeid);
      if(dnode == undefined) {
        //console.log('d =', d)
        //console.log('snode =', snode)
        //console.log('dnode = ', snode.ports[d.port_idx-1].dest_node)
        console.error('TimeSummary.compute() could not find dnode for id', snode.ports[d.port_idx-1].dest_node)
        return;
      }

      let lidx = (snode.lvl < dnode.lvl) ? 3*snode.lvl : 3*dnode.lvl;
      let didx = (snode.lvl < dnode.lvl) ? 0 : 1;

      let v = d.rcv_data;

      vals[lidx + didx].push(v);    vals[lidx + 2].push(v);
      vals[9 + didx].push(v);       vals[9 + 2].push(v);
    });

    vals.forEach( function(v, i){

      if (vals[i].length == 0)
        return

      summary[i].values.push( d3.max( vals[i]) );
      summary[12+i].values.push( d3.mean( vals[i]) );
    });
    timeSteps.push(tstamp);
  });

  timeSteps.sort( d3.ascending );
}

function update(newdata) {

  logger.log('TimeSummary.update(', newdata, ')');

  let show_byLvl = document.querySelector('input[name=summarybylvl]').checked;
  let show_byDir = document.querySelector('input[name=summarybydir]').checked;
  let type = document.getElementById("timemetric").value;

  let typeIdx = (type == 'max') ? 0 : 12;

  let curves = [];
  let entries = [];

  let summaryInfo = UI.summaryInfo();

  if (show_byDir && show_byLvl) {

    curves.push( summary[typeIdx+0] );  curves.push( summary[typeIdx+1] );
    curves.push( summary[typeIdx+3] );  curves.push( summary[typeIdx+4] );
    curves.push( summary[typeIdx+6] );  curves.push( summary[typeIdx+7] );

    entries = summaryInfo.filter( d => d.label.includes('\u2192'));

  } else if(show_byLvl){

    curves.push( summary[typeIdx+2] );
    curves.push( summary[typeIdx+5] );
    curves.push( summary[typeIdx+8] );

    entries = summaryInfo.filter( d => d.label.includes('\u2194'));

  } else if(show_byDir){

    curves.push( summary[typeIdx+9] );  curves.push( summary[typeIdx+10] );

    entries = summaryInfo.filter( d => d.label.includes('up') || d.label.includes('down'));

  } else {
    curves.push( summary[typeIdx+11] );
    entries = summaryInfo.filter( d => d.label.includes('all'));
  }

  let ncolors = entries.map(d => d.cls);
  timeSummaryChart.data(timeSteps, curves, ncolors);

  if(newdata)
    reset();
}

function reset() {
  timeSummaryChart.select();
}

/* -------------------------------------------------------------------------- */
let pcnt = 0;
function init() {

  let div = d3.select("#divsummary");

  let d = div.append('div').attr('class', 'inputDiv');
  d.append('button').text('Reset Active Time Range').on('click', reset);


  d = div.append('div').attr('class', 'inputDiv')
  .on('mouseover', d => window.atooltip('metric to be used for summary curves in time-chart'))
  .on('mouseout', d => window.atooltip())

  d.append('label').text('Timechart Metric: ')

  d = d.append('select').attr('id', 'timemetric').on('change', update)
  d.append('option').attr('name', 'max').attr('value', 'max').text('Max')
  d.append('option').attr('name', 'mean').attr('value', 'mean').text('Mean')


  timeSummaryChart = TimeChart()
                          .on('brushed', d => {
                            //console.log(' ------ going to publish again', pcnt,' !', d)
                            //pcnt++;
                            publish('timerange_updated', {timerange: d})
                          });

  d3.select('#canvassummarytime').call(timeSummaryChart);

  subscribe('counters_updated', function(channel, data) {
    compute(data.counters);
    update(true);
  });
  subscribe('summarylvl_changed', function(channel, data) {
    logger.log('\n\nTimeSummary:received: summarylvl_changed', data);
    update(false);
  });
  subscribe('summarydir_changed', function(channel, data) {
    logger.log('\n\nTimeSummary:received: summarydir_changed', data);
    update(false);
  });
  subscribe('file_selected', function(channel, data) {
    let t = Model.get_timestamp(data.filename);
    timeSummaryChart.select([t,t]);
  });
  subscribe('jobs_selected', function(channel, data) {
    if (data.trange.length > 0)
      timeSummaryChart.select(data.trange);
  });
}

/* -------------------------------------------------------------------------- */

export default {
  init(){     return init();  }
};

/* -------------------------------------------------------------------------- */

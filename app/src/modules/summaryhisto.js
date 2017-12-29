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

import Histogram from '../component/histogram';
import Topology from '../model/topology';
import Counters from '../model/counters';

import UI from './uicounters.js'

/* -------------------------------------------------------------------------- */
let histogramChart = null;
let counters = null,
    switches = null;

/* -------------------------------------------------------------------------- */
function brushMode_changed() {

  let btype = document.querySelector('input[name=histobrush]:checked').value;
  let brange = histogramChart.selection();
  logger.log('\nHistoSummary.publish: histogram_brushed(', counters.length, ',', brange, ',', btype, ')');
  publish('histogram_brushed', {counters: counters, switches: switches, valrange: brange, type: btype});
}
function histogram_brushed(brange) {

  let btype = document.querySelector('input[name=histobrush]:checked').value;
  logger.log('\n\nHistoSummary.publish: histogram_brushed(', counters.length, ',', brange, ',', btype, ')');
  publish('histogram_brushed', {counters: counters, switches: switches, valrange: brange, type: btype});
}

/* -------------------------------------------------------------------------- */
function update(resnap_needed) {

  logger.log("HistoSummary.update(", resnap_needed,"). # counters =", counters.length);

  let show_byLvl = document.querySelector('input[name=summarybylvl]').checked;
  let show_byDir = document.querySelector('input[name=summarybydir]').checked;

  let ndata = [];
  let entries = [];

  let summaryInfo = UI.summaryInfo();

  if (show_byLvl && show_byDir) {

    for (var i = 0; i < 6; i++) {
      ndata.push( new Array() );
    }

    counters.forEach(function (l){

      if (l.nodefrom == null || l.nodeto == null)
        return;

      let lvl = (l.type == 'up') ? 2*l.nodefrom.lvl :
                (l.type == 'down') ? 2*l.nodeto.lvl+1 : -1;
      ndata[lvl].push ( l.rcv_data );
    });

    entries = summaryInfo.filter( d => d.label.includes('\u2192') );
  }

  else if(show_byLvl) {

    for (var i = 0; i < 3; i++) {
      ndata.push( new Array() );
    }

    counters.forEach(function (l){

      if (l.nodefrom == null || l.nodeto == null)
        return;

      let lvl = (l.type == 'up') ? l.nodefrom.lvl :
                (l.type == 'down') ? l.nodeto.lvl : -1;
      ndata[lvl].push ( l.rcv_data );
    });

    entries = summaryInfo.filter( d => d.label.includes('\u2194') );
  }

  else if(show_byDir) {

    for (var i = 0; i < 2; i++) {
      ndata.push( new Array() );
    }

    counters.forEach(function (l){

      if (l.nodefrom == null || l.nodeto == null)
        return;

      let lvl = (l.type == 'up') ? 0 :
                (l.type == 'down') ? 1 : -1;
      ndata[lvl].push ( l.rcv_data );
    });

    entries = summaryInfo.filter( d => d.label.includes('up') || d.label.includes('down'));
  }

  else {
    ndata.push( new Array() );

    counters.forEach(function (l){

      if (l.nodefrom == null || l.nodeto == null)
        return;
      ndata[0].push ( l.rcv_data );
    });

    entries = summaryInfo.filter( d => d.label.includes('all'));
  }

  let ncolors = entries.map(d => d.cls);

  histogramChart.data(ndata, ncolors)

  if (resnap_needed) {
    histogramChart.snap2bins();
  }
}

/* -------------------------------------------------------------------------- */
function init() {

  let nbins = 20;

  let context = d3.select("#divsummary");
  let d = null;
  // --------------------------------------------------

  d = context.append('div').attr('class', 'inputDiv')
  .on('mouseover', d => window.atooltip('data filtering includes/excludes the value range selected by histogram brush'))
  .on('mouseout', d => window.atooltip())

  d.append('label').text('Histogram Brushing: ');

    d.append('input').attr('type', 'radio')
     .attr('name', 'histobrush')
     .attr('value', 'inclusive')
     .on('change', brushMode_changed)
     .property("checked", "true");

    d.append('text').text('incl.');

    d.append('input').attr('type', 'radio')
     .attr('name', 'histobrush')
     .attr('value', 'exclusive')
     .on('change', brushMode_changed);

    d.append('text').text('excl.');

  d = context.append('div').attr('class', 'inputDiv')
  .on('mouseover', d => window.atooltip('number of histogram bins (approximate and suggested only...)'))
  .on('mouseout', d => window.atooltip())

  d.append('label').text('Histogram No. of Bins :')

    d.append('input').attr('type', 'number')
     .attr('id', 'histonbins')
     .attr('min', 1)
     .attr('value', nbins)
     .on('change', function() {
        histogramChart.num_bins(this.value)
                      .snap2bins();
      })

    d.append('text').text('(approx.)');

  histogramChart = Histogram()
                    .on('brushed', histogram_brushed)
                    .num_bins(nbins);

  d3.select('#canvassummaryhisto').call(histogramChart);

  // ---------------------------------------------------
  subscribe('timerange_updated', function(channel, data) {
    logger.log('HistoSummary.received: timerange_updated(', data.timerange, ')');

    if (data.timerange == undefined) {
      counters = []
      switches = []
    }
    else {
      let v = Counters.aggregate(data.timerange);
      counters = v.links;
      switches = v.switches;
    }
    update(true);
  });
  subscribe('summarylvl_changed', function(channel, data) {
    //logger.log('HistoSummary:received: summarylvl_changed', data);
    update(false);
  });
  subscribe('summarydir_changed', function(channel, data) {
    //logger.log('HistoSummary:received: summarydir_changed', data);
    update(false);
  });
}

/* -------------------------------------------------------------------------- */

export default {
  init(){     return init();  }
};

/* -------------------------------------------------------------------------- */

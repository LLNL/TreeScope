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

import Topology from './topology';
import Counters from './counters';
import {publish,subscribe} from '../utils/pubsub.js'

// ----------------------------------------------------------
// utility functions
// ----------------------------------------------------------

const dateFormat_filename = d3.timeParse('%Y%m%d-%H%M%S');        // string to time

function get_timestamp(filename) {
  return dateFormat_filename( filename.split("/").pop().split(".")[0] );
}

function parse_filename(filename) {

  let toks = filename.split(".");
  return {
    fname:  filename,
    extn:   toks[toks.length-1],
    tstamp: dateFormat_filename(toks[toks.length-2])
  };
}

// ----------------------------------------------------------
// load all data in a directory
// ----------------------------------------------------------

function load(url){

  logger.log('\nModel.load(',url,')')


  window.astatus('fetching data from',url)
  fetch(url+'/listing.txt')

    // parse the listing file
    .then(function (response) {
      if (!response.ok)
        throw Error(response.statusText + ' ('+response.url+')');
      return response.text().then(text => text.trim(' ').split('\n'))
    })

    // read all files
    .then(function(response) {

      let files = response.map( d => parse_filename(d) );
      files = files.sort( function(a,b){  return d3.ascending(a.tstamp, b.tstamp);  })

      let jobsfile = url+'/slurmqlog/sqlog.txt';
      let topofile = url+'/network.topo'
      let countfiles = files.filter(f => f.extn == 'count')
      let rtablefiles = files.filter(f => f.extn == 'rtable')

      let readPromises = [];

      // required data
      window.astatus('reading', countfiles.length, 'counter files')
      readPromises.push( Topology.load(topofile) );
      logger.log(' Reading', countfiles.length, 'counter files')
      countfiles.forEach(function(f, i) {
        readPromises.push(Counters.load(f.tstamp, url+'/'+f.fname));
      });

      Promise.all(readPromises)
        .then( () => {

          logger.log('   Reading counter files finished!')
          logger.log('Model.load finished! Succesfully loaded required data!\n')
          //window.astatus('read', countfiles.length, 'counter files')

          //console.log(Topology.nodes())
          Counters.fix();

          publish('jobs_toberead', {url: jobsfile});
          publish('routes_toberead', {url: url, files: rtablefiles});

          publish('directoryListing_updated', countfiles);
          publish('topology_updated', {num_pods: Topology.nPods()});
          publish('counters_updated', {counters: Counters.data()});
        })
        .catch(function (error){
          //logger.critical('Model.load failed: ', error)
          logger.critical(error)
        })
    })
  .catch(function (error){
    logger.critical('Model.load failed: ', error)
  })
}

function init() {
  logger.log('Model.init()');
}

// --------------------------------------------
export default {

  init() {            return init();            },
  load(_) {           return load(_);           },
  get_timestamp(_) {  return get_timestamp(_);  }
}

// --------------------------------------------

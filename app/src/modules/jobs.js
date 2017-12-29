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


// This module deals with everything about jobs
    // reads, parses, and loads the data
    // supports job-based queries
    // handles job-based ui
    // displays job table

import * as d3 from 'd3';
import {publish, subscribe} from '../utils/pubsub.js'

import CTable from '../component/table';
import Topology from '../model/topology';

/* -------------------------------------------------------------------------- */
const dateFormat_fromfile = d3.timeParse('%m/%d-%H:%M:%S');        // string to time
const dateFormat_toui = d3.timeFormat('%m.%d %H:%M:%S');

let jobyear = -1;   // the jobs file do not have year information, so it is needed from outside
let data = [];

let timerange = undefined;
let table = null;

let header = [
      {label: "start", width: 66, cls: 'notlast'},
      {label: "time", width: 33, cls: 'notlast tcolnum'},
      {label: "n", width: 22, cls: 'notlast tcolnum'},
      {label: "name", width: 50, cls: ''}
    ];

const master_colortable = ['rgb(31,120,180)', 'rgb(51,160,44)', 'rgb(227,26,28)',
                           'rgb(255,127,0)', 'rgb(106,61,154)', 'rgb(177,89,40)',
                           'rgb(166,206,227)', 'rgb(178,223,138)', 'rgb(251,154,153)',
                           'rgb(253,191,111)', 'rgb(202,178,214)', 'rgb(255,255,153)',
                           'crimson', 'seagreen', 'steelblue', 'magenta'];



let job_colors = new Map();

/* -------------------------------------------------------------------------- */
// data handling

// add class to a job when it is selected
function job_classator(job_id) {

  if (job_colors.has(job_id))
    return job_colors.get(job_id);

  job_colors.set(job_id, master_colortable[job_colors.size]);
  return job_colors.get(job_id);
  //return (idx == -1) ? 'q0-0' : 'q'+idx+'12';
}

function get_numsecs(s) {
  return s.split(':').reduce( (acc, val) => (acc*60 + (+val)), 0);
}

function intersection(a, b) {

  if (a == undefined)   return b;
  if (b == undefined)   return a;

  let r0 = (a[0] > b[0]) ? a[0] : b[0];
  let r1 = (a[1] < b[1]) ? a[1] : b[1];
  return (r0 < r1) ? [r0, r1] : undefined;
}

function find(id) {

  let jobs = data.filter(d => d.id == id);
  if (jobs.length == 1) {  return jobs[0];  }
  if (jobs.length == 0){   return null;     }
  console.error('jobs.find(',id,') found', jobs.length, 'jobs')
}

function timerange4jobs(jobs) {

  let trange = undefined;

  for (let job of jobs) {
    trange = intersection(trange, [job.tstart, job.tend]);
    if (trange == undefined){
      break;
    }
  }
  return trange;
}

function nodes4jobs(jobs) {

  let l0nodes = [];
  let l1nodes = [];

  // compute the union set for l1 and l0
  jobs.forEach( function(job) {
    job._l0.forEach( n => l0nodes.push(n) );
    job._l1.forEach( n => l1nodes.push(n) );
    //l1nodes = l1nodes.concat( job._l1.map(n => ({id: n.id, jobid: job.id, ncount: n.count})));
  });


  l0nodes = Array.from(new Set(l0nodes));
  l1nodes = Array.from(new Set(l1nodes));

  //console.log(l0nodes)
  //console.log(l1nodes)

  // now filter out l1 nodes that are not in any of the jobs
  jobs.forEach( function(job) {
    l1nodes = l1nodes.filter( d => job._l1.includes(d) )
    l0nodes = l0nodes.filter( d => job._l0.includes(d) )
  });

  //console.log(l0nodes)
  //console.log(l1nodes)

  return {l0: l0nodes, l1: l1nodes};
}

// add ids of l0 and l1 to all jobs
function add_topology() {

  if (Topology.isnull())
    return;

  data.forEach(job => {

    let nodes = job.nodes.map(n => Topology.node_by_name(n))
    nodes = nodes.filter(n => n != undefined)

    job._l0 = nodes.map(n => n.id)
    job._l1 = []

    let l1 = nodes.map(n => n.ports[0].dest_node)
    let c = l1.reduce( (r,k)=>{r[k]=1+r[k]||1;  return r},  {})

    for(let k in c) {
      job._l1.push( {id: k.toString(), count: c[k]} )
    }
  })
}

/* -------------------------------------------------------------------------- */
function parse(text) {

  data = text.trim(" ").split('\n');

  //          JOBID   PART    NAME      USER    ST       START       TIME        N      NODELIST
  let reg = /\b(\d+) +(\w+) +([\w.-]+) +(\w+) +(\w+) ([\d\/\-\:]+) +([\d\:]+) +(\d+) +(\w+)([^]+)/;

  data = data.map(function (row, i) {

    if(!reg.test(row)){
      return;
    }

    let toks = reg.exec(row)
    return {
      id:    +toks[1],
      part:   toks[2],
      name:   toks[3],
      user:   toks[4],
      st:     toks[5],
      tstart: dateFormat_fromfile(toks[6]),
      start:  dateFormat_toui(dateFormat_fromfile(toks[6])),
      time:   toks[7],
      n:         +toks[8],
      nodeprefix: toks[9],
      nodelist:   toks[10]
    }
  });

  data = data.filter(j => j != undefined);

  data.forEach(function(job) {

    job.tstart.setYear(jobyear);

    job.numsecs = get_numsecs(job.time);

    job.tend = new Date();
    job.tend.setTime(job.tstart.getTime() + (job.numsecs*1000));

    job.nodes = [];

    if (job.nodelist[0] == '[' && job.nodelist[job.nodelist.length-1] == ']' ) {
      job.nodelist = job.nodelist.slice(1, -1);
    }

    job.nodelist.split(',').map(l => {
      let rng = l.split('-').map(d => +d);
      switch(rng.length) {
        case 1: {
                  job.nodes.push(job.nodeprefix+rng[0])
                  break;
                }
        case 2: {
                  for(let i = rng[0]; i <= rng[1]; i++)
                    job.nodes.push(job.nodeprefix+i)
                  break;
                }
      }
    });
    if(job.nodes.length != job.n) {
      logger.log('\n Error: found', job.nodes.length, 'nodes, but expected', job.n)
      logger.log(job.nodelist)
    }
  });

  return data;
}

function load(filename, year) {

  jobyear = year;
  return fetch(filename)
        .then(response => response.text())
        .then(parse)
        .then(() => {
          logger.log(' Jobs.load(', filename, ') loaded', data.length, 'jobs');
          update();
          add_topology();
        });
}

/* -------------------------------------------------------------------------- */
// ui handling

function jobn() {
  let n = +document.getElementById("job_n").value;
  if (n < 0) {
    n = 0;    document.getElementById("job_n").value = 0;
  }
  return n;
}
function jobtime() {

  let h = +document.getElementById("job_timeh").value;
  if (h < 0){
    h = 0;    document.getElementById("job_timeh").value = 0;
  }

  let m = +document.getElementById("job_timem").value;
  if (m < 0){
    m = 0;    document.getElementById("job_timem").value = 0;
  } else if (m > 59){
    m = 59;   document.getElementById("job_timem").value = 59;
  }

  let s = +document.getElementById("job_times").value;
  if (s < 0){
    s = 0;    document.getElementById("job_times").value = 0;
  } else if (m > 59){
    s = 59;   document.getElementById("job_times").value = 59;
  }

  return h*3600 + m*60 + s;
}
function jobtrange() {
  return document.getElementById("job_timesync").checked;
}

function setlabel_tab(a, b, c) {
  d3.select('#job_labeltab').text('Showing ' + a + ' of ' + b + ' jobs')
}
function setlabel_sel(a) {
  d3.select('#job_labelsel').text('Selected ' + a + ' jobs')
}

function job_label(job) {

  if (job == undefined)   return ''
  return ' job ( ' + job.id + ' ' + job.name +' ) ran from ' +
              job.tstart + ' to ' + job.tend + ' on ' +
              job.nodes.length + ' nodes and used ' + job._l1.length + ' L1 switches'
}

/* -------------------------------------------------------------------------- */
// callback

function job_mouseover(job){
  window.atooltip( job_label(job) )
}

function job_clicked(selection) {

  logger.log('\n jobs.job_clicked', selection);

  let sclicked = selection.clicked;

  if (selection.type == 'deselected') {
    if (sclicked != undefined) {
      window.atooltip('deselected', job_label(sclicked) )
    }
    else {
      window.atooltip('deselected jobs which did not satisfy the new filtering.')
    }
  }

  let sselection = selection.selection;

  // TODO.. directly publish to clear fattree?
  if (sselection.length == 0) {
    publish('jobs_selected', {jobs: [], colors: [], trange: []});
    setlabel_sel(0);
    return;
  }

  let nsel = sselection.length;
  let jobs = sselection.map(sel => find(sel.id));
  let jobColors = sselection.map(sel => sel.color);

  let t = timerange4jobs(jobs);
  console.log(jobs)
  console.log(t)

  // this should never happen since table is already filtered!
  if (t == undefined) {
    window.aerror('selected jobs do not have a common time period. discarding last selection.')
    alert('Selected jobs do not share a common time period!\nDiscarding last selection!')
    table.deselect(sclicked)
    setlabel_sel(nsel-1);
    return;
  }

/*
  let n = nodes4jobs(jobs);
  if(n.l0.length == 0 || n.l1.length == 0){
    window.aerror('selected jobs do not share any nodes and switches. discarding last selection.')
    //alert('Selected jobs do not share any node!\nDiscarding last selection!')
    table.deselect(sclicked)
    setlabel_sel(nsel-1);
    return;
  }*/


/*let l1nodes = [];
  jobs.forEach( job => {
    l1nodes = l1nodes.concat( job._l1.map(n => ({id: n.id, jobid: job.id, ncount: n.count})));
  });
*/

  window.atooltip('selected', job_label(sclicked) )
  setlabel_sel(nsel);
  publish('jobs_selected', {jobs: jobs, colors: jobColors, trange: t});
}

// -----------------------------------------------------
// sorting and filtering functions

function sortfunc(data, colname, desc) {

  let sort0 = (desc) ? d3.descending : d3.ascending;

  if (colname == 'start') {
    data.sort( (a,b) => sort0(a.start, b.start) ||
                      d3.descending(a.numsecs, b.numsecs) || d3.descending(a.n, b.n) ||
                      d3.ascending(a.id, b.id)
              );
  } else if (colname == 'time') {
    data.sort( (a,b) => sort0(a.numsecs, b.numsecs) ||
                        d3.descending(a.start, b.start) || d3.descending(a.n, b.n) ||
                        d3.ascending(a.id, b.id)
             );
  } else if (colname =='n') {
    data.sort( (a,b) => sort0(a.n, b.n) ||
                        d3.descending(a.start, b.start) || d3.descending(a.numsecs, b.numsecs) ||
                        d3.ascending(a.id, b.id)
             );
  } else if (colname == 'name') {
    data.sort( (a,b) => sort0(a.name, b.name) ||
                        d3.descending(a.numsecs, b.numsecs) || d3.descending(a.n, b.n) ||
                        d3.ascending(a.id, b.id)
             );
  }
}

// -----------------------------------------------------
// table update

function update() {

  let t = jobtime();
  let n = jobn();
  let tr = jobtrange();

  let jobsList = data.filter(d => d.n >= n && d.numsecs >= t)

  if (tr) {
    jobsList = jobsList.filter(d => {
      //console.log('job: ', d.tstart, d.tend, '--', timerange)
      return (undefined != intersection(timerange, [d.tstart, d.tend]))
    });
  }

  table.data(jobsList)
       .update();

  setlabel_tab(jobsList.length, data.length);
  setlabel_sel(table.num_selected());
}

// -----------------------------------------------------
function init() {

  let context = d3.select("#divjobs");
  let d = null;
  // ---------------------------------------------------
  context.append('h3').text("Jobs");

  d = context.append('div').attr('class', 'inputDiv')
  .on('mouseover', d => window.atooltip('filter job table based on the job duration'))
  .on('mouseout', d => window.atooltip())

  d.append('label').text('Show longer than ');

    d.append('input').attr('type', 'number')
     .attr('id', 'job_timeh').on('change', update)
     .attr('min', 0);

    d.append('label').text(' : ');

    d.append('input').attr('type', 'number')
     .attr('id', 'job_timem').on('change', update)
     .attr('min', 0).attr('max', 59);

    d.append('label').text(' : ');

    d.append('input').attr('type', 'number')
     .attr('id', 'job_times').on('change', update)
     .attr('min', 0).attr('max', 59);

  d = context.append('div').attr('class', 'inputDiv')
  .on('mouseover', d => window.atooltip('filter job table based on number of nodes used'))
  .on('mouseout', d => window.atooltip())

    d.append('label').text('Show larger than ');

    d.append('input').attr('type', 'number')
     .attr('id', 'job_n').on('change', update)
     .attr('class', 'wide')
     .attr('min', '1')

    d.append('label').text(' nodes');

  d = context.append('div').attr('class', 'inputDiv')
  .on('mouseover', d => window.atooltip('filter job table based on time-range selected in the time-chart'))
  .on('mouseout', d => window.atooltip())

  d.append('text').text('Show only in selected time range ');

    d.append('input').attr('type', 'checkbox')
     .attr('id', 'job_timesync').on('change', update)

  context.append('div').attr('class', 'inputDiv').append('label').attr('id', 'job_labeltab');
  context.append('div').attr('class', 'inputDiv').append('label').attr('id', 'job_labelsel');

  // ---------------------------------------------------
  d3.select('#job_timeh').attr('value', 0);
  d3.select('#job_timem').attr('value', 1);
  d3.select('#job_times').attr('value', 0);
  d3.select('#job_n').attr('value', 1);
  d3.select('#job_timesync').property("checked", "true");
  setlabel_tab(0,0);
  setlabel_sel(0);

  // ---------------------------------------------------
  table = CTable()
            .colorator(job_classator)
            .on('mouseover', job_mouseover)
            .on('clicked', job_clicked);

  context.append('table')
           .attr('id', 'tableJobs')
           .attr('class', 'scrollable')
           .call(table);

  table.header(header)
       .sortinit('time', true)
       .sortfunc(sortfunc);


  // ---------------------------------------------------
  subscribe('jobs_toberead', function(channel, data){

    let retval = window.prompt('slurmqlog files specify time-stamps without the year. Please enter the year for which the jobs were run.' +
    '\n\n (different jobs running in different years are not supported in the current version)', '2016');

    let year = parseInt(retval, 10)

    if (Number.isNaN(year)) {
      window.alert('Invalid year. Skipping job loading.')
      //return;
      year = 2016
    }

    console.log('year = ', year)
    load(data.url, year);
  });

  subscribe('timerange_updated', function(channel, data){
    timerange = data.timerange;
    if (jobtrange())
      update();
  });
}

/* -------------------------------------------------------------------------- */
export default {
  init(){       return init();  }
};

/* -------------------------------------------------------------------------- */

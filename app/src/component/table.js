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

// This module populates a table based on given data

import * as d3 from 'd3';

export default function() {

  let context = null;

  let data = [],
      header = [],
      selected_rows = [];

  let row_colorator = null;

  let sortfunc = null,
      sortColumn = null,
      sortDesc = null;

  let dispatch = d3.dispatch('clicked', 'mouseover');

  function table(_) {
    context = _;

    context.append("thead").append("tr");
    context.append("tbody");
    return this;
  }

  table.colorator = function(_) {
    row_colorator = _;
    return this;
  }
  table.num_selected = function() {
    return selected_rows.length;
  }
  table.sortinit = function(c, d) {
    sortColumn = c;   sortDesc = d;
    return this;
  }
  table.sortfunc = function(_) {
    sortfunc = _;
    return this;
  }
  table.on = function(type, listener) {
    dispatch.on(type, listener);
    return this;
  }
  table.data = function(_) {
    data = _;

    // if there is any selected row not present in the new data,
    // i need to remove it from the selection
    let nsel = selected_rows.length

    let dids = data.map(d => d.id);
    selected_rows = selected_rows.filter( s => dids.includes(s.id) )

    if (nsel != selected_rows.length) {
      dispatch.call('clicked', this, {clicked: undefined, type: 'deselected', selection: selected_rows});
    }
    return this;
  }
  table.header = function(_) {

    header = _;

    let d3head = context.select("thead tr")
                      .selectAll("th")
                      .data(header);

    d3head.enter()
          .append("th")
          .merge(d3head)
            .text(d => d.label[0].toUpperCase()+d.label.substr(1))
            .attr('width', d => d.width || 20)
            .attr('class', d => d.cls)
            .on('click', header_clicked);

    d3head.exit().remove();
    return this;
  }

  function header_clicked(d) {

    if (d.label == sortColumn) {  sortDesc = !sortDesc; }
    else {                        sortColumn = d.label; }
    table.update();
  }

  function row_clicked(row, idx) {

    let d3tr = d3.select(this);
    let d3tr_clsd = d3tr.classed('selectedRow');

    // needs to be deselected
    if (d3tr_clsd) {

      selected_rows = selected_rows.filter(v => v.id != row.id);
      d3tr.classed('selectedRow', false)
          .style('color', 'black');

      dispatch.call('clicked', this, {clicked: row, type: 'deselected', selection: selected_rows});
      return;
    }

    let col = row_colorator(row.id);

    // needs to be (multi)selected
    if (d3.event.metaKey){

      selected_rows.push( {id: row.id, color: col} );
      d3tr.classed('selectedRow', true)
          .style('color', col);
    }
    else {

      selected_rows = [ {id: row.id, color: col} ];
      context.selectAll('tbody tr')
             .classed("selectedRow", r => (row.id == r.id))
             .style('color', r => (row.id == r.id) ? col : 'black');
    }
    dispatch.call('clicked', this, {clicked: row, type: 'selected', selection: selected_rows});
  }

  function selected_idx(row) {
    for(let i in selected_rows) {
      if (selected_rows[i].id == row.id) return i;
    }
    return -1;
  }
  function is_selected(row) {
    return -1 != selected_idx(row);
  }
  function row_color(row) {
    let idx = selected_idx(row);
    return (idx == -1) ? 'black' : selected_rows[idx].color;
  }
  table.deselect = function(obj) {

    if (obj == undefined)   return;
    selected_rows = selected_rows.filter(d => d.id != obj.id);
    context.selectAll('tbody tr')
           .filter(d => d.id == obj.id)
           .classed("selectedRow", false)
           .style('color', 'black');
  }
  table.update = function() {

    sortfunc(data, sortColumn, sortDesc);
    context.select('thead tr').selectAll('th')
      .classed("sortDesc", h => sortDesc && sortColumn == h.label)
      .classed("sortAsc", h => !sortDesc && sortColumn == h.label);

    let d3rows = context.select("tbody")
                          .selectAll("tr")
                          .data(data);
    d3rows.exit().remove();

    d3rows = d3rows.enter()      // for each row in the data
        .append("tr")
        .merge(d3rows)
          .classed('selectedRow', d => is_selected(d))
          .style('color', d => row_color(d))
          .on('click', row_clicked)
          .on('mouseout', d => dispatch.call('mouseover', this, undefined))
          .on('mouseover', d => dispatch.call('mouseover', this, d));

    let d3cells = d3rows.selectAll("td")
                        .data(row => header.map(function(h) {
                                      return {column: h, value: row[h.label]};
                                    }));
    d3cells.exit().remove();

    d3cells.enter()    // for each column in the row
          .append("td")
          .merge(d3cells)
            .attr('width', d => d.column.width || 20)
            .attr('class', d => d.column.cls)
            .text(d => d.value);
  }

  return table;
}

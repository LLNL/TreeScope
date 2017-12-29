## Main features of TreeScope v1.0

The main features of TreeScope are outlined below; more details about
TreeScope are provided in a forthcoming publication. The tool loads multiple
modules on startup. Each module creates its own UI.

#### Data Module

The system loads the data `<data>/*.count` and `<data>/*.rtable` from the
specified path, and the following two drop down boxes are populated. The
network information is also loaded from `<data>/network.topo` file.

- 'Counters': This contains all the time-stamps available. If any time-stamp
  is selected in the drop down, all modules are updated to show data only for
the chosen time-stamp. Manual selection of 'multiple' option is ignored. To
select multiple time-stamps, use the time-chart in the summary module.

- 'Routing Tables': This contains the starting time-stamps for the available
  routing tables. This selection works independently of anything else, and is
used for highlighting the routes. This does not update the current
visualization, but selects the effective routing table for any future
queries. The user should make sure the correct routing table is used.

#### Jobs Module

The system expects to find a `<data>/slurmqlog/sqlog.txt` file in the loaded
data path, and loads the job listing and populates a table. Ths job table is
sortable (click on headers), filterable (using the filtering options in UI),
and multi-selectable (click on rows).

There is a two-way synchronization between job-table and time-chart:

* When a time-range is selected in the time-chart, the available jobs outside
that time-range are not shown. You can use the checkbox 'Show only in
selected time range' to enable this synchronization.

* When a job (Job 1) is selected (by clicking on the corresponding row), the
time-chart is (always) updated to highlight the time-range in which Job 1
was active. This automatically updates all visualizations (histograms,
aggregates, colormaps, etc) to show the data only for the time-period that
Job 1 was running for.

	If the checkbox 'Show only in selected time range' is selected, then
the update of time-chart to match Job 1 will trigger a back-update on the
job-table (previous point).  This is useful to further narrow down to the
jobs that were collocated in time with Job 1, although this can be disabled
using the checkbox.

On selecting a row, the job is highlighted (in color), and any switches and
links not part of this job are faded out. If multiple jobs are selected, then
any switches and links not part of ALL the selected jobs are faded out. In
other words, the intersection of all selected jobs is shown. Job placement is also visualized on L0 switches.

#### Summary Module

Once the data has been loaded, the summary module gets activated. The summary
can be grouped by level and or the direction of the link. The
available checkboxes allow making this choice.

##### Time-Summary

A time-summary is created for the entire time-range of the available counter
data. This contains mean or max of the counters (chosen through the UI
dropdown).

A brush is provided to choose a time-range within this time-chart. On
choosing a time-range, the following happens:

* Job-table is filtered (described in Jobs Module)
* Data in the chosen time-range is aggreagated (summed) and visualized using
the histogram module and the fat-tree module.


##### Histogram

The aggregated data for the time-range is shown as a histogram in this
module. The histogram also responds to the grouping of by level and
direction. You can also specify the number of bins for the histogram,
although that may not be the exact number of bins in the output. d3 tries to
match the number of bins but in order to keep the bin-width a rounded
integer, it may change the number of bins.

Brushing is also available for this module. You can choose a function range,
and the links shown in the fat-tree module will be filtered accordingly.


#### Fat-Tree Module

Finally, after summarization, aggregation, and histogram-based filtering, the
counters are shown in the fat-tree module. The design and layout of this
visualization can be changed using the UI.

The elements of fat-tree (switches and links) are clickable. On click,
information about the selected object is printed on the console (for Chrome,
please use View -> Developer Tools -> Javascript Console. this will be moved
to a status bar in a later version).

Furthermore, on click, the route between the selected switches is
highlighted. If more than two switches are selected, then routes between all
possible src-dest pairs in the selected set is shown.

#### Cascaded selection of routing

There are two ways on highlighting a route: by selecting a job, and by
selected elements in the fat-tree. You can do a combination of both (i.e.,
one or more jobs, as well as two or more switches), and an intersection of
the resulting routes will be shown. This is useful to first look at all the
links of a job, and then filter down on a particular pair of end-points.

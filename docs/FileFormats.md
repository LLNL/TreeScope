## TreeScope v1.0: File Format Specifications

For consistency, scalability, and easy usability of TreeScope for different use-cases, we use a consistent data format. This document specifies the data format. Some utility tools for data conversion are provided in `TreeScope/tools`

The data collected from the hardware consists of three types of information, each to be provided in a separate types of files, all included in a single directory.

#### network topology information
A single file `<data>/network.topo` is required, and contains the information about the network topology. This is a `json` file, an example of which is given below. At the top, the global parameters of the network are given. For example, the name of the network, number of cores (director switches) and pods, the number of ports of a switch at a given level that are connected to switches at a different level (num_L1L2 = 18 means for any given L1 switch, 18 ports are connected to L2 switches).

The file also contains a list of all (compute) nodes and switches in the network with details on the connections for every port.
  - If a port is not connected, or a link is down, the corresponding port number contains an empty string as dest node (e.g., port number 10)
  - `lvl` is needed for all switches
  - `pod` is needed for `L1` and `L2` switches
  - `core` is needed for `L2` and `L3` switches, and contains the id of the director switch
  - `idx` is an ordering defined for visualization. For three levels, the ordering are defined differently (see `TreeScope/tools/process_topology.py`)
  	- for `L1` switches, indexing sorts the switches first on pod and then on lid
  	- for `L2` switches, indexing sorts the switches first on pod and then on core switch, and then on switch name (for cab, switch name already contains core switch name)
  	- for `L3` switches, indexing sorts the switches on core switch, and then on switch name (for cab, switch name already contains core switch name)
  - note that `idx` is different from `id`, which contains node identifier, usually its mac address

```
{
 "name":"machine_name",
 "num_cores":2, "num_pods":4,
 "num_L1L0":18, "num_L1L2":18, "num_L2L1":18, "num_L2L3":18, "num_L3L2":36,
 "nodes":[
  {
	"id":"0011:aaaa:bbbb:cccc", "name":"node01", "lid":1037,
	"ports":[
		{ "num":1, "dest_node":"0011:aaaa:bbbb:eeee", "dest_port":9 },
	]
  },
  ...
  ...
 ],
 "switches":[
  {
	"id":"0011:aaaa:bbbb:dddd", "name":"ib01", "lid":170,
	"lvl":2, "pod":0, "idx":11, "core":"ibcore2",
	"ports":[
		{ "num":1, "dest_node":"0011:aaaa:bbbb:ddd1", "dest_port":1 },
		...
		{ "num":10, "dest_node":"", "dest_port":-1 },
		...
		{ "num":36, "dest_node":"0011:aaaa:bbbb:ddd9", "dest_port":14 }
	]
  },
  ...
  ...
 ]
}
```

#### network counters
`<data>/[timestamp].count` file will contain *all* the counters (collected per-link) for a particular time-stamp. This file is to be written for *every* time-stamp. This is a csv file with the following format.

`node_id, port_id, counter_1, ..., counter_n`

#### routing tables
`<data>/[timestamp].rtable` file will contain the routing table for a particular time-stamp. Since routing tables are dynamic, these files are to be provided only for the time-steps where the table is different from the previous time-step. The routing table is required for the first time-step. These are csv files with the following format.

`node_id, lid:portnum, lid:portnum, ....`

where, `lid:portnum ... ` is a map of lid to port number for a given node, and tells the system how to route an incoming packet.

#### job queue
Additionally, the file `<data>/slurmqlog/sqlog.txt` should provide the *job queue* to enable job-related queries.

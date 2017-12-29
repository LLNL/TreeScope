### Parsing the system history files into TreeScope format

The network data to be visualized could be coming from different sources. For consistency, scalability, and easy usability, TreeScope uses a specific dataformat. Description about data formats can be found in `TreeScope/docs/FileFormats.md`. Here, we describe the tools for data conversion, which is done in three steps.

#### `OSMHistoryParser`

This java program parses a set of `*.his` files into sets of `*count`, `*topo`, and `*rtable` files.

- Download the required java libraries: the lib folder in the repository `https://github.com/LLNL/OMSClient`
- Create a symlink to the lib folder in the current folder, and set appropriate java paths.
- Compile and run.

```
$ pwd
TreeScope/tools

$ ln -s <path-to-OMSClient>/lib javalibs
$ export JAVA_HOME=/usr/lib/jvm/jre-1.8.0-oracle.x86_64
$ export PATH=/usr/lib/jvm/jre-1.8.0-oracle.x86_64/bin:$PATH

$ javac -extdirs ./javalibs -encoding ISO-8859-1 OSMHistoryParser.java
$ java -classpath .:./javalibs/* OSMHistoryParser [path-to-his-files]
```

#### `remove_redundantRoutes`

Most `*.topo` and `*.rtable` files are expected to not change across time-stamps. The script `remove_redundantRoutes.py` deletes (backs up) these redundant files, so the tool can figure out not to read duplicate ones. This script uses the shell's `diff` command to check whether the files have changed or not. Therefore, in order to be able to use this script, care must be taken to write the json tags in the same order.

```
$ pwd
TreeScope/tools

$ python remove_redundantRoutes.py --indir [dir-of-files]
```

#### `process_topology`

The information in `*.topo` files gathered from `OSMHistoryParser` contains basic information about the network in terms of nodes, switches, and their connectivities. The script `process_topology` appends more information taken from network config into the `*.topo` files.

```
$ pwd
TreeScope/tools

$ python process_topology.py --input [topo-file] or [dir-of-topo-files]
```

In particular, the `*.topo` file is augmented with the following information:
`num_cores`,`num_pods`,`num_L1L0`,`num_L1L2`,`num_L2L1`,`num_L2L3`,`num_L3L2`. For more information about these fields, please see `TreeScope/FileFormats.md`.

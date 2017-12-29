'''
TreeScope, Version 0.1
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
'''

from sys import argv
import os, glob
import argparse
import json

# --------------------------------------------
nodes = {}
switches = {}
nports = []

def validate():

    countbylevels = [0,0,0]
    countbypods = [0,0,0,0]

    for switch in switches.values():

        countbylevels[ switch["lvl"]-1 ] = countbylevels[ switch["lvl"]-1 ] +1
        if switch["lvl"] == 1 or switch["lvl"] == 2:
            countbypods[ switch["pod"] ] = countbypods[ switch["pod"] ] +1

    print 'Switches by levels:', countbylevels[0], countbylevels[1], countbylevels[2]
    print 'Switches by pods:  ', countbypods[0], countbypods[1], countbypods[2], countbypods[3]

def find_numConnectedPorts(node):

    count = 0
    for port in node["ports"]:
        if port["dest_node"] != "":
            count = count+1
    return count

def assign_levels():

    print '\n------- Assigning levels'
    skipped_some = False

    currentn = nodes
    for currentl in range(0,3):

        print 'Starting with', len(currentn), 'nodes at level', currentl
        nextn = {}
        for node in currentn.values():

            for port in node["ports"]:

                destid = port["dest_node"]
                if destid not in switches:      # must be a valid switch
                    continue

                destnode = switches[destid]
                if destnode["lvl"] != -1:       # must be already assigned
                    continue

                if find_numConnectedPorts(destnode) != nports[currentl+1]:
                    skipped_some = True

                else:
                    destnode["lvl"] = currentl+1
                    nextn[destid] = destnode

        print '\tFound', len(nextn), 'switches at level', (currentl+1)
        currentn = nextn
        currentl = currentl+1


    if skipped_some == False:
        return

    print 'Some nodes were skipped... Do a backward propagation of levels'

    for currentl in range(3,1,-1):

        print 'Starting with', len(currentn), 'nodes at level', currentl
        nextn = {}
        for node in currentn.values():

            for port in node["ports"]:

                destid = port["dest_node"]
                if destid not in switches:      # must be a valid switch
                    continue

                destnode = switches[destid]

                if destnode["lvl"] == currentl+1:
                    continue

                if destnode["lvl"] != currentl-1:
                    destnode["lvl"] = currentl-1

                nextn[destid] = destnode

        print '\tFound', len(nextn), 'switches at level', (currentl-1)
        currentn = nextn
        currentl = currentl+1

def assign_cores():

    print '\n------- Assigning cores'
    cores = set()
    for switch in switches.values():

        if switch["lvl"] == 2 or switch["lvl"] == 3:

            toks = switch["desc"].split(" ")
            switch["core"] = toks[0]
            cores.add(toks[0])

    print '\tFound', len(cores), 'cores'

def determine_pod(node):

    if node["lvl"] != 1:
        return -1

    if node["pod"] != -1:
        return node["pod"]

    for port in node["ports"]:

        destid = port["dest_node"]
        if destid not in switches:      # must be a node
            continue

        destnode = switches[destid]

        if destnode["pod"] != -1:
            return destnode["pod"]

    return node["pod"]

def set_pod(node, p):

    if node["lvl"] != 1:
        return

    node["pod"] = p
    for port in node["ports"]:

        destid = port["dest_node"]
        if destid not in switches:      # must be a node
            continue

        destnode = switches[destid]
        destnode["pod"] = p

def assign_pods():

    print '\n------- Assigning pods'

    for switch in switches.values():
        if switch["lvl"] == 1 or switch["lvl"] == 2:
            switch["pod"] = -1

    pod = 0
    for switch in switches.values():

        if switch["lvl"] != 1:
            continue

        p = determine_pod(switch)

        # a new pod id is needed
        if p == -1:
            p = pod
            pod = pod+1

        # set pod ids
        set_pod(switch, p)

def l3sorter(a, b):

    if a["core"] != b["core"]:
        return -1 if (a["core"] < b["core"]) else 1

    return -1 if (a["id"] < b["id"]) else 1
    #return -1 if (a["lid"] < b["lid"]) else 1

def l2sorter(a, b):

    if a["pod"] != b["pod"]:
        return -1 if (a["pod"] < b["pod"]) else 1

    if a["core"] != b["core"]:
        return -1 if (a["core"] < b["core"]) else 1

    return -1 if (a["id"] < b["id"]) else 1
    #return -1 if (a["lid"] < b["lid"]) else 1

def l1sorter(a, b):

    if a["pod"] != b["pod"]:
        return -1 if (a["pod"] < b["pod"]) else 1

    return -1 if (a["id"] < b["id"]) else 1
    #return -1 if (a["lid"] < b["lid"]) else 1

def assign_ids():

    l1 = []
    l2 = []
    l3 = []

    for switch in switches.values():

        if switch["lvl"] == 1:
            l1.append(switch)

        if switch["lvl"] == 2:
            l2.append(switch)

        if switch["lvl"] == 3:
            l3.append(switch)

    l3 = sorted(l3, cmp=l3sorter)
    l2 = sorted(l2, cmp=l2sorter)
    l1 = sorted(l1, cmp=l1sorter)

    idx = 0
    for l in l1:
        l["idx"] = idx
        idx = idx+1

    idx = 0
    for l in l2:
        l["idx"] = idx
        idx = idx+1

    idx = 0
    for l in l3:
        l["idx"] = idx
        idx = idx+1

def process_topology(config, filename):

    global nports

    print '\n .Processing', filename
    json_data = open(filename).read()
    data = json.loads(json_data)

    data["name"] = config["name"]
    data["num_cores"] = config["num_cores"]
    data["num_pods"] = config["num_pods"]
    data["num_L1L0"] = config["num_L1L0"]
    data["num_L1L2"] = config["num_L1L2"]
    data["num_L2L1"] = config["num_L2L1"]
    data["num_L2L3"] = config["num_L2L3"]
    data["num_L3L2"] = config["num_L3L2"]

    nports = [1, (data["num_L1L0"]+data["num_L1L2"]),
                 (data["num_L2L1"]+data["num_L2L3"]),
                  data["num_L3L2"]]

    # ---------------------------------------------------
    # create a map of json ojects
    for node in data["nodes"]:
        nodes[node["id"]] = node

    for switch in data["switches"]:
        switch["lvl"] = -1
        switches[switch["id"]] = switch

    print 'Read', len(nodes), 'nodes and', len(switches), 'switches'

    assign_levels()
    assign_cores()
    assign_pods()
    assign_ids()
    validate()

    data["nodes"] = nodes.values()
    data["switches"] = switches.values()

    #filename = "temp.json"
    with open(filename, 'w') as f:
        json.dump(data, f, sort_keys=True, separators=(',', ':'), indent=0)

# --------------------------------------------

if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Process network topology file, and add level, pod, core, and idx information to all switches');
    parser.add_argument('--config', metavar='(config)', required=True, nargs=1, help='Network configuration');
    parser.add_argument('--input', metavar='(input)', required=True, nargs=1, help='Input directory or *.topo file');

    args = parser.parse_args()

    infiles = []
    if os.path.isdir(args.input[0]):
        infiles = glob.glob( args.input[0]+'/*.topo')
    else:
        infiles.append(args.input[0])

    #print infiles

    json_config = open(args.config[0]).read()
    config = json.loads(json_config)

    #print config

    for filename in infiles:
        process_topology(config, filename)

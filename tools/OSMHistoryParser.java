/*
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
*/

import java.util.Map;
import java.util.TreeMap;
import java.util.LinkedHashMap;
import java.util.Set;
import java.util.TreeSet;

import java.io.File;
import java.io.FileWriter;
import java.io.BufferedWriter;

import java.io.FilenameFilter;
import java.io.IOException;

import java.text.ParseException;
import java.text.SimpleDateFormat;

import gov.llnl.lc.infiniband.core.IB_Link;
import gov.llnl.lc.infiniband.opensm.plugin.data.*;

public class OSMHistoryParser {

  public static void main(String[] args) throws Exception {

      if (args.length != 1) {         showUsage();    System.exit(1); }
      if (args[0].equals("help")){    showUsage();    System.exit(1); }

      processOMSHistory(args[0]);
  }
  private static void showUsage(){
      System.out.println(" --- OSMHistoryParser : parses a binary history file into three CSV files ---");
      System.out.println(" OSMHistoryParser <arg>");
      System.out.println("");
      System.out.println("Usage:");
      System.out.println(" OSMHistoryParser help                   - Shows this help/usage message.");
      System.out.println(" OSMHistoryParser /path/to/hisDir        - Extract data from OMS '.his' files located in a given path.");
      System.out.println(" OSMHistoryParser /path/to/hisFile       - Extract data from a single '.his'");
  }
  private static FilenameFilter fnameFilter = new FilenameFilter() {
      public boolean accept(File dir, String name) {
          return name.endsWith(".his");
      }
  };

  private static String FormatTimeStamp(String timestamp) throws ParseException {
      java.util.Date temp = new SimpleDateFormat("MMM dd HH:mm:ss yyyy").parse(timestamp);
      return new SimpleDateFormat("yyyyMMdd-HHmmss").format(temp);
  }

  // the file naming of hist file is not standard! <alas!>
  // this function tries to make a guess of what prefix should be used
  private static String createPrefix(String filepath) {

      // get the filename from the full path without extension
      filepath = filepath.substring(filepath.lastIndexOf("/")+1, filepath.length() - 4);

      int idx = filepath.indexOf(".");
      if (idx >= 0) {
          String p1 = filepath.substring(0, idx);
          String p2 = filepath.substring(idx+1, filepath.length());

          // one of these should be a timestamp, other a tag/name
          if( Character.isLetter(p1.charAt(0)) )
              return p1;
          else if( Character.isLetter(p2.charAt(0)) )
              return p2;
      }
      return filepath;
  }

  // -----------------------------------------------------------------------------
  // Complete Network
  // -----------------------------------------------------------------------------
  public static class MNetwork {

    // ---------------------------------------------------------------------------
    // A single port (on a switch or an end node)
    // ---------------------------------------------------------------------------
    private class MPort {

      public String _connectedNode;
      public int _connectedPort;

      public MPort() {
        _connectedNode = "";
        _connectedPort = -1;
      }
      public boolean isConnected() {
        return (_connectedPort != -1);
      }
      public void connect(String connectedNode, int connectedPort) {
        _connectedNode = connectedNode;
        _connectedPort = connectedPort;
      }
    }

    // ---------------------------------------------------------------------------
    // A single switch (also an end node)
    // ---------------------------------------------------------------------------
    private class MSwitch {

      // data given by the source
      public final String _nguid;
      public final String _name;
      public final int _numPorts;
      public final boolean _isSwitch;

      public int _lid;
      public int _numConnectedPorts;
      public MPort[] _ports;

      public MSwitch(String nguid, String name, boolean isSwitch, int numPorts){

        _nguid = nguid;
        _name = name;
        _numPorts = numPorts;

        _lid = -1;
        _numConnectedPorts = 0;
        _isSwitch = isSwitch;

        _ports = new MPort[_numPorts];
        for(int i = 0; i < _numPorts; i++) {
          _ports[i] = new MPort();
        }
      }

      public String get_jsonString(String indent) {

        String s = indent + "{" +
                   " \"id\": \"" + _nguid + "\"," +
                   " \"desc\": \"" + _name + "\"," +
                   " \"lid\": " + _lid + ",";
        s = s + "\n";
        s = s + indent + "  \"ports\":[";

        if(_numPorts > 1) {
          s = s + "\n";
        }

        String indent2 = (_numPorts == 1) ? "" : indent;
        for(int i = 0; i < _numPorts; i++) {

           String dsnode = "";
           int dsport = -1;

           if(_ports[i].isConnected()){
              dsnode = _ports[i]._connectedNode;
              dsport = _ports[i]._connectedPort;
           }
           s = s + indent2 + indent2 + "{" +
               " \"num\": " + (i+1) + ", \"dest_node\": \"" + dsnode + "\", \"dest_port\": " + dsport + "}";

          if(i != _numPorts-1)
            s = s + ",";

          if(_numPorts > 1) {
              s = s + "\n";
          }
        }
        s = s + indent2 + "  ]\n";
        s = s + indent + "}";
        return s;
      }

      public MPort get_port(int portId) throws Exception {

        if (portId > _numPorts || portId < 1) {
          System.out.println(" get_port(): Invalid portId " + portId + ". Only " + _numPorts + " ports exist!");
          throw new Exception();
        }
        return _ports[portId-1];
      }

      public void connect_port(int portId, int lid, String otherNodeId, int otherPortId) throws Exception {

        //System.out.println(" connect_port(" + lid + ") " + ", " + _lids.get(0) + " [" + _nguid + "]["+portId+"]" + " lvl = " + _lvl);

        if ( _lid != lid && _lid != -1) {
          System.out.println(" connect_port(): lid mismatch " + lid + " != " + _lid);
          System.out.println(get_jsonString(" "));
          throw new Exception();
        }
        if (portId > _numPorts || portId < 1) {
          System.out.println(" connect_port(): Invalid portId " + portId + ". Only " + _numPorts + " ports exist!");
          throw new Exception();
        }

        _lid = lid;

        // if this port is already connected, verify the connection!
        int cport = _ports[portId-1]._connectedPort;
        String cnode = _ports[portId-1]._connectedNode;

        if (cport != -1) {

          if(!cnode.equals(otherNodeId) || cport != otherPortId) {
            System.out.println(" connect_port(): [" + _nguid + "-" + portId + "] is already mapped to [" + cnode + "-" + cport + "]" +
                                                " while trying to map to [" + otherNodeId + "-" + otherPortId + "]");
            throw new Exception();
          }
          return;
        }

        _ports[portId-1].connect(otherNodeId, otherPortId);
        _numConnectedPorts ++;
      }

      TreeSet<String> get_connectedNodes() {

        TreeSet<String> connectedNodes = new TreeSet<String>();

        for(int i = 0; i < _numPorts; i++) {

          if( _ports[i].isConnected() )
            connectedNodes.add(_ports[i]._connectedNode);
        }
        return connectedNodes;
      }
    }

    // ---------------------------------------------------------------------------
    // ---------------------------------------------------------------------------

    private int num_nodes, num_switches;
    private TreeMap<String, MSwitch> _nodeMap = new TreeMap<String, MSwitch>();

    // ---------------------------------------------------------------------------

    public MNetwork() {

      num_nodes = 0;
      num_switches = 0;
    }

    private void add_nodes(OSM_Fabric fabric) {

      System.out.print("   Adding nodes...");

      int nn = num_nodes;
      int ns = num_switches;

      try {
        LinkedHashMap<String, OSM_Node> osMSwitchs = fabric.getOSM_Nodes();
        for(Map.Entry<String, OSM_Node> entry: osMSwitchs.entrySet()){

          OSM_Node onode = entry.getValue();
          String guid = onode.getNodeGuid().toColonString();

          boolean is_switch = onode.isSwitch();
          SBN_Node sbnNode = onode.sbnNode;

          int num_ports = (sbnNode != null) ? sbnNode.num_ports : -1;
          String name = (sbnNode != null) ? sbnNode.description: "unknown";

          // if this node exists, verify
          if( _nodeMap.containsKey( guid ) ) {

            MSwitch node = _nodeMap.get(guid);

            if (node._numPorts != num_ports || node._isSwitch != is_switch ) {
              System.out.println(" create_nodes(): failed at mismatch!");
              throw new Exception();
            }

            continue;
          }

          MSwitch node = new MSwitch( guid, name, is_switch, num_ports );

          if(is_switch) {    num_switches++;   }
          else {             num_nodes++;      }

          _nodeMap.put(guid, node);
        }
      } catch (Exception e){
        System.out.println(" create_nodes(): failed!");
        e.printStackTrace();
        System.exit(1);
      }
      if(num_nodes > nn || num_switches > ns) {
        System.out.println(" Created " + (num_nodes-nn) + " nodes and " + (num_switches-ns) + " switches." +
                              " New total = " + _nodeMap.size() + "(" + num_nodes + " + " + num_switches + ")");
      }
      else {
        System.out.println(" Done! Total nodes = " + _nodeMap.size() + "(" + num_nodes + " + " + num_switches + ")");
      }
    }

    private void add_links(OSM_Fabric fabric) {

      System.out.print("   Adding links...");

      Integer countPortsConnected0 = 0;
      for(Map.Entry<String, MSwitch> entry: _nodeMap.entrySet()){
        countPortsConnected0 += entry.getValue()._numConnectedPorts;
      }

      try {
        LinkedHashMap<String, IB_Link> ibLinks = fabric.getIB_Links();
        for(Map.Entry<String, IB_Link> entry: ibLinks.entrySet()){

          IB_Link iLink = entry.getValue();
          OSM_Port oPort1 = iLink.getEndpoint1();
          OSM_Port oPort2 = iLink.getEndpoint2();

          String node1Guid = oPort1.getNodeGuid().toColonString();
          String node2Guid = oPort2.getNodeGuid().toColonString();

          Integer node1Lid = oPort1.getAddress().getLocalId();
          Integer node2Lid = oPort2.getAddress().getLocalId();

          Integer node1Port = oPort1.getPortNumber();
          Integer node2Port = oPort2.getPortNumber();

          MSwitch nodeSrc = _nodeMap.get(node1Guid);
          MSwitch nodeDst = _nodeMap.get(node2Guid);

          if(nodeSrc == null) {
            System.out.println(" node " + node1Guid + " not found!");
            throw new Exception();
          }
          if(nodeDst == null) {
            System.out.println(" node " + node2Guid + " not found!");
            throw new Exception();
          }

          // set the lid and connect the port
          nodeSrc.connect_port(node1Port, node1Lid, node2Guid, node2Port);
          nodeDst.connect_port(node2Port, node2Lid, node1Guid, node1Port);
        }
      } catch (Exception e){
        System.out.println(" create_links(): failed!");
        e.printStackTrace();
        System.exit(1);
      }

      Integer countPortsConnected1 = 0;
      for(Map.Entry<String, MSwitch> entry: _nodeMap.entrySet()){
        countPortsConnected1 += entry.getValue()._numConnectedPorts;
      }

      if(countPortsConnected1 > countPortsConnected0) {
        System.out.println(" Connected " + (countPortsConnected1-countPortsConnected0) + " ports. New total = " + countPortsConnected1);
      }
      else {
        System.out.println(" Done! Total ports = " + countPortsConnected1);
      }
    }

    public void write_network(String filename) {

      System.out.print("   Writing network...");

      try {

        File outfile = new File(".", filename);
        outfile.createNewFile();
        BufferedWriter bwriter = new BufferedWriter(new FileWriter(outfile));

        bwriter.write("{");
        /*
        bwriter.write(" \"name\": \"" + _fabric.getFabricName() + "\"," +
                      "\n"
                    );
        */
        // --------------------------------------

            // --------------------------------------
            bwriter.write("  \"nodes\":[\n");
            int count = 0;
            for (Map.Entry<String, MSwitch> entry : _nodeMap.entrySet()) {
              MSwitch s = entry.getValue();

              if(s._isSwitch) continue;

              bwriter.write( entry.getValue().get_jsonString("   "));

              if(count++ != num_nodes-1)
                bwriter.write( ",");

              bwriter.write("\n");
            }
            bwriter.write("  ],\n");

            // --------------------------------------
            bwriter.write("  \"switches\":[\n");
            count = 0;
            for (Map.Entry<String, MSwitch> entry : _nodeMap.entrySet()) {
              MSwitch s = entry.getValue();

              if(!s._isSwitch)
                continue;

              bwriter.write( entry.getValue().get_jsonString("   "));

              if(count++ != num_switches-1)
                bwriter.write( ",");

              bwriter.write("\n");
            }
            bwriter.write("  ]\n");

        // --------------------------------------
        bwriter.write("}\n");
        bwriter.flush();
        bwriter.close();
      } catch (Exception e){
        System.out.println(" write_Json(): Unable to write to file.");
        e.printStackTrace();
        System.exit(1);
      } finally {
      }
      System.out.println(" Done!");
    }

    public static void write_portCounters(OSM_Fabric fabric, String filename) {

      System.out.print("   Writing port counters to file " + filename + "...");
      try {

        File outfile = new File(".", filename);
        outfile.createNewFile();
        BufferedWriter bwriter = new BufferedWriter(new FileWriter(outfile));

        LinkedHashMap<String, OSM_Port> ports = fabric.getOSM_Ports();

        bwriter.write("node_id,port_idx,"+
                      "rcv_data"
			/*+",rcv_err,rcv_switch_relay_err,rcv_rem_phys_err,rcv_constraint_err,"+
                      "xmit_data,xmit_discards,xmit_wait,xmit_constraint_err,"+
                      "multicast_rcv_pkts,multicast_xmit_pkts,unicast_rcv_pkts,unicast_xmit_pkts,"+
                      "symbol_err_cnt,vl15_dropped,buffer_overrun,link_downed,link_err_recover,link_integrity"*/
                      );
        bwriter.newLine();

        for (Map.Entry<String, OSM_Port> entry: ports.entrySet()){

          String portId = entry.getKey();
          OSM_Port port = entry.getValue();

          String nguid = portId.substring(0, 19);
          int portNum = Integer.parseInt(portId.substring(20));

          //System.out.println("portID = " + portId + " nguid = " + nguid + " portNum = " + portNum);
          if (port.getPfmPort() == null){
              continue;
          }

          bwriter.write(nguid + "," + portNum + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.rcv_data)*4 /*+ "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.rcv_err) + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.rcv_switch_relay_err) + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.rcv_rem_phys_err) + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.rcv_constraint_err) + "," +
                          //
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.xmit_data)*4 + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.xmit_discards) + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.xmit_wait) + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.xmit_constraint_err) + "," +
                          //
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.multicast_rcv_pkts) + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.multicast_xmit_pkts) + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.unicast_rcv_pkts) + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.unicast_xmit_pkts) + "," +
                          //
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.symbol_err_cnt) + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.vl15_dropped) + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.buffer_overrun) + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.link_downed) + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.link_err_recover) + "," +
                          port.pfmPort.getCounter(PFM_Port.PortCounterName.link_integrity)*/
                        );
          bwriter.newLine();
        }
        bwriter.close();
      } catch (Exception e) {
          System.out.println(" write_portCounters(): failed!");
          e.printStackTrace();
          System.exit(1);
      } finally {
      }
      System.out.println(" Done!");
    }

    private static void write_routing(OSM_Fabric fabric, String filename) {

      String indent = " ";
      try{

        System.out.print("   Parsing Routing Table and writing to file " + filename + "...");
        RT_Table _rTable = RT_Table.buildRT_Table(fabric);

        File outfile = new File(".", filename);
        outfile.createNewFile();
        BufferedWriter bwriter = new BufferedWriter(new FileWriter(outfile));

        bwriter.write( "nodeid, lid:portnum, lid:portnum, ....\n");

        // for each switch in the routing table
        for (Map.Entry<String, RT_Node> nEntry: _rTable.getSwitchGuidMap().entrySet()){

          RT_Node rnode  = nEntry.getValue();
          String rnguid = rnode.getGuid().toColonString();

          // data is given by RT_Table as a port->lid Map
          // we will write it as an inverse map (lid->port) to allow efficient route finding
          TreeMap<Integer, Integer> forwardingTable = new TreeMap<Integer, Integer>();
          for (Map.Entry<String,RT_Port> pEntry: rnode.getPortRouteMap().entrySet()){

            RT_Port rport = pEntry.getValue();
            int rportNum = rport.getPortNumber();

            for (Map.Entry<String,Integer> item: rport.getLidGuidMap().entrySet()){
              forwardingTable.put( item.getValue(), rportNum );
            }
          }

          // now write this node and its map
          bwriter.write( rnguid + ",");

            int nports = forwardingTable.size();
            int iports = 0;
            for (Map.Entry<Integer, Integer> entry : forwardingTable.entrySet()) {

              //System.out.println(entry.getKey() + " : " + entry.getValue());
              bwriter.write(entry.getKey() + ":" + entry.getValue());

              if(iports++ != nports-1) {
                bwriter.write(",");
              }
            }

          bwriter.write("\n");
        }
        bwriter.close();
      } catch (Exception e){
        System.out.println(" write_routing(): Unable to write to file.");
        e.printStackTrace();
        System.exit(1);
      }
      System.out.println(" Done!");
    }
  }

  private static void processOMSHistory(String arg){

      // collect all files to be processed
      File[] hisFiles = null;

      // check if this is a path or a file
      File path = new File(arg);
      if (!path.exists()) {
          System.err.println(" Path not found: " + arg);
          System.exit(1);
      }

      if(path.isDirectory()){
          hisFiles = path.listFiles(fnameFilter);
      }
      else if(path.isFile()){
          hisFiles = new File[1];
          hisFiles[0] = path;
      }
      else {
          System.err.println(" Incorrect path: " + arg);
          System.exit(1);
      }

      OMS_Collection omsHistory = null;
      OpenSmMonitorService oms = null;

      // ---

      MNetwork mn = new MNetwork();

      try {
          int cntfile = 0;
          for (File hisFile : hisFiles){

              System.out.println("");
              System.out.println("Processing history file: " + hisFile.getPath());

              omsHistory = OMS_Collection.readOMS_Collection(hisFile.getPath());

              String filePrefix = createPrefix(hisFile.getPath());

              System.out.println(" - found " + omsHistory.getSize() + " time-steps");
              for (int i = 0; i < omsHistory.getSize(); i++){

                  oms = omsHistory.getOMS(i);

                  if(oms.getTimeStamp() == null){
                    System.out.println("\n\n\n\n [[[ Skipping snapshot " + (i+1) + " becuase OMS " + hisFile.getPath() + " gave null timestamp ]]] \n\n\n\n");
                    continue;
                  }

                  long timestamp = oms.getTimeStamp().getTimeInSeconds();
                  String formattedString = FormatTimeStamp( oms.getTimeStamp().toString() );

                  System.out.println("\n  .snapshot["+(i+1)+"]: " + oms.getTimeStamp().toString() + " (" + formattedString + ").");

                  //MNetwork mn = new MNetwork(oms.getFabric());

                  mn.add_nodes(oms.getFabric());
                  mn.add_links(oms.getFabric());

                  mn.write_portCounters(oms.getFabric(), formattedString + ".count");
                  mn.write_routing(oms.getFabric(), formattedString + ".rtable");

                  //mn.write_network(filePrefix + "." + formattedString + ".topo");
                  //mn.write_portCounters(filePrefix + "." + formattedString + ".count");
                  //mn.write_routing(filePrefix + "." + formattedString + ".rtable");
              }
          }

          mn.write_network("network.topo");

      } catch (Exception e) {
              System.err.println("Couldn't open the file");
              e.printStackTrace();
      }
      System.out.println("- Complete");
  }
}

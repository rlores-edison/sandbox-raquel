import React, { useEffect, useState, useRef } from "react";
import { ForceGraph2D } from "react-force-graph";
import dagre from "@dagrejs/dagre";



const Graph = ({json_data, background_color, link_color}) => {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [collapsedNodes, setCollapsedNodes] = useState({});
  const [nodeJsonFound, setNodeJsonFound] = useState(null);
  // Define larger virtual canvas dimensions to allow nodes to maintain size
 
  const [dimensions, setDimensions] = useState({
    width: visualViewport.width,
    height: visualViewport.height,
  });
  const initialZoom = 1.5;
  const nodesepValue = 40;
  const ranksepValue = 28;

   // Recalculate dimensions on window resize
   useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (json_data && Object.keys(json_data).length > 0) {
      const adaptedData = adaptDbToGraph(json_data);
      const collapsed_nodes = {};
      adaptedData.nodes.forEach((node) => {
        collapsed_nodes[node.id] = true;
      });

      setCollapsedNodes(collapsed_nodes);
      setGraphData(adaptedData);
    }
  }, [json_data]);

  const groupedMarkers = {
    group1: ["site"],
    group2: ["instalacion"],
    group3: ["instalZone"],
    group4: ["tipoEquipo"],
    group5: ["equip"],
    group6: ["secEquip"],
    group7: ["point"],
  };

  const groupToMarkerMap = Object.entries(groupedMarkers).reduce((acc, [group, markers]) => { 
    markers.forEach((marker) => {
    acc[group] = marker; // Reverse mapping of groupedMarkers to make it easy to access the marker by the node.group to display the marker in the node label.
  });
  return acc;
  }, {});
  
  const getColorForNode = (group) => {
    const colors = {
      group1: "#812921",
      group2: "#0c63ef",
      group3: "#f4bb00",
      group4: "#85db15",
      group5: "#79e5f5",
      group6: "#9200f4",
      group7: "#e61806",
    };
    return colors[group] || "#f94dbd";
  };

  // Function to adapt the database data into the graph format
  const adaptDbToGraph = (json_data) => {
    const nodes = [];
    const links = [];
    // Store existing links to avoid duplicates
    const existingLinks = new Set();
    Object.keys(json_data).forEach((key) => {
      const item = json_data[key];
      // Ensure the item has an 'fid' before processing
      if (!item || !item.fid) {
        console.error(`Skipping item with missing fid:`, item);
        return; // Skip this item if 'fid' is missing
      }

      const nodeType = Object.keys(groupedMarkers).find((group) =>
        groupedMarkers[group].some(
          (marker) => item.markers && item.markers.includes(marker)
        )
      );

      // Helper function to determine parent based on group
      const getParentGroup = (nodeType) => {
        if (nodeType === "group2") {
          return item.siteRef.fid;
        } else if (nodeType === "group3") {
          return item.instalacionRef.fid;
        } else if (nodeType === "group4") {
          return item.instalZoneRef.fid;
        } else if (nodeType === "group5") {
          return item.tipoEquipoRef.fid;
        } else if (nodeType === "group6") {
          return item.equipRef.fid;
        } else if (nodeType === "group7") {
          if (item.secEquipRef?.fid) {
            return item.secEquipRef.fid;
          } else {
            return item.equipRef.fid;
          }
        }
      };

      if (nodeType) {
        // Create the node
        nodes.push({
          id: item.fid, // Unique identifier for the node
          name: item.navName,
          group: nodeType,
          parent: getParentGroup(nodeType), // To reference the parent node
        });
        // Helper function to create unique links
        const createUniqueLink = (source, target, group) => {
          const linkKey = `${source}-${target}-${group}`;
          if (!existingLinks.has(linkKey)) {
            links.push({ source, target, group }); // Include the group in the link
            existingLinks.add(linkKey);
          }
        };
        if (item.markers.includes("instalacion") && item.siteRef?.fid) {
          createUniqueLink(
            item.siteRef.fid,
            item.fid,
            "group1",
            item.siteRef.fid
          ); // Link instalacion to site using siteRef.fid
        }
        if (item.secEquipRef) {
          createUniqueLink(
            item.secEquipRef.fid,
            item.fid,
            "group6",
            item.secEquipRef.fid
          ); // Connect secEquip to point
        } else if (item.equipRef) {
          createUniqueLink(
            item.equipRef.fid,
            item.fid,
            "group5",
            item.equipRef.fid
          ); // Connect equip to point if no secEquip
        } else if (item.tipoEquipoRef) {
          createUniqueLink(
            item.tipoEquipoRef.fid,
            item.fid,
            "group4",
            item.tipoEquipoRef.fid
          ); // Connect tipoEquipo to equip
        } else if (item.instalZoneRef) {
          createUniqueLink(
            item.instalZoneRef.fid,
            item.fid,
            "group3",
            item.instalZoneRef.fid
          ); // Connect instalZone to tipoEquipo
        } else if (item.instalacionRef) {
          createUniqueLink(
            item.instalacionRef.fid,
            item.fid,
            "group2",
            item.instalacionRef.fid
          ); // Connect instalacion to instalZone
        }
      }
    });


    //Use dagre to calculate the layout
    const layoutData = getLayout({ nodes, links });
    return layoutData;
  };
  

  const getLayout = ({ nodes, links }) => {
    // This function initializes a Dagre graph
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ nodesep: nodesepValue, ranksep: ranksepValue });
    graph.setDefaultEdgeLabel(() => ({}));
    
    // Set each node to fixed size
      nodes.forEach((node) => {
        graph.setNode(node.id, { width: 20, height: 30 });
    });
  
    // Add edges
    links.forEach((link) => {
      graph.setEdge(link.source, link.target);
    });

    //Run the layout
    dagre.layout(graph); 

    //Update node positions
    const updatedNodes = nodes.map((node) => {
      const dagreNode = graph.node(node.id);
      return { ...node, x: dagreNode.x, y: dagreNode.y };
    });
    return { nodes: updatedNodes, links };
  };



  //Helper function to recursively collapse all descendants of a node
  const collapseBranch = (node, allNodes, collapsedNodes) => {
    // Collapse the current node
    let updatedCollapsedNodes = {
      ...collapsedNodes,
      [node.id]: true, // Ensure this node is collapsed
    };
    // Find all children (nodes whose parent is this node's id)
    const children = allNodes.filter((n) => n.parent === node.id);

    //Recursively collapse each child node
    children.forEach((child) => {
      updatedCollapsedNodes = collapseBranch(
        child,
        allNodes,
        updatedCollapsedNodes
      );
    });
    return updatedCollapsedNodes;
  };

  // Function to collapse/expand a node
  const handleNodeClick = (node) => {
    setCollapsedNodes((prev) => {
      // If the node is collapsed, expand it
      if (prev[node.id]) {
        return {
          ...prev,
          [node.id]: false, // Expand the node
        };
      } else {
        // If the node is being collapsed, collapse the node and all its child nodes
        return collapseBranch(node, graphData.nodes, prev);
      }
    });
  };

  // Function to determine which nodes are down
  const getVisibleGraph = () => {
    // List of visible (not collapsed) nodes
    const visibleNodes = [];
    const visibleLinks = [];
    // Create a node map by ID for easy access to parents
    const nodeMap = new Map(graphData.nodes.map((node) => [node.id, node]));
    // Adding visible nodes
    graphData.nodes.forEach((node) => {
      let isVisible = true;
      let parent = nodeMap.get(node.parent);
      //If any of the parents is collapsed, the node is not visible
      while (parent) {
        if (collapsedNodes[parent.id]) {
          isVisible = false;
          break;
        }
        parent = nodeMap.get(parent.parent);
      }
      if (isVisible) {
        visibleNodes.push(node);
      }
    });

    // Adding visible links
    graphData.links.forEach((link) => {
      const found = visibleNodes.some((node) => {
        const sourceId =
          typeof link.source === "object" ? link.source.id : link.source;
        const targetId =
          typeof link.target === "object" ? link.target.id : link.target;
        return sourceId === node.parent && targetId === node.id;
      });
      if (found) {
        visibleLinks.push(link);
      }
    });
    return { nodes: visibleNodes, links: visibleLinks };
  };

  
 
  const getInitialVisibleNodes = () => {
    return getVisibleGraph().nodes.filter((node) => node.group === "group1" || node.group === "site");
   };
  //    // Use effect to zoom to fit only initial visible nodes and apply custom centering
  //    // useEffect(() => {
  //    //   if (fgRef.current) {
  //    //     // Get initial visible "group1" or "site" nodes
  //    //     const initialVisibleNodes = getInitialVisibleNodes();
  //    //     fgRef.current.zoomToFit(1000, 150, (node) => initialVisibleNodes.includes(node));
  //        // Apply initial zoom after zoomToFit
  //    //     setTimeout(() => {
  //    //       fgRef.current.zoom(initialZoom);
  //    //     }, 1000);
  //    //   }
  //    // }, [graphData]);
  
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.zoom(initialZoom); // Set initial zoom 
      fgRef.current.centerAt(200, 200, 1);
    } 
  }, [getInitialVisibleNodes]);

  return (

    <div>
      <ForceGraph2D
        graphData={getVisibleGraph()}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor={background_color}
        nodeAutoColorBy="group"
        // nodeRelSize={1}
        // nodeVal={4}
        linkColor={() => link_color}
        ref={fgRef}
        cooldownTicks={0}
        // onEngineStop={() => fgRef.current.zoomToFit(400, 100)}
        onNodeClick={handleNodeClick} // Call handleNodeClick in the nodes
        nodeLabel={(node) => `${groupToMarkerMap[node.group]}`}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.name;
          const fontSize = 11 / globalScale;
          const radius = 8; // Set fixed radius for consistent node size

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = getColorForNode(node.group);
          ctx.fill();
          ctx.font = `${fontSize}px 'Sans-Serif', 'Helvetica'`;
          ctx.textAlign = "right";
          ctx.textBaseline = "right";
          ctx.fillStyle = "#0000FF";
          ctx.fillText(label, node.x - 15, node.y + 1);
        }}
      />

      {/* Modal with node info */}
      {nodeJsonFound && (
        <Modal node={nodeJsonFound} on_close={handleCloseModal} />
      )}

    </div>
  );
};

export default Graph;
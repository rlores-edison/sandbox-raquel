import Graph from "./Max30NodesGraph.jsx";
import { useEffect, useState } from "react";


  
const Home = () => {
  const [jsonData, setJsonData] = useState({});


  useEffect(() => {
    fetch("../../server/dataSmall.json")
      .then((response) => response.json())
      .then((data) => {
        console.log(data);
        setJsonData(data);
      })
      .catch((error) => console.error("🤷 Error fetching data:", error));

    }, [])

   return (

    <div>
      {/* Graph component is rendered here */}
      <Graph 
        json_data={jsonData}
        background_color={"#fdfdfd"}
        link_color={"#0000FF"}
      />
    </div>

);
};

export default Home;


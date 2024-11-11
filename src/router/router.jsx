import { createBrowserRouter } from "react-router-dom";
import Home from "../components/Home.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
]);
export default router;


// App.js
import Login from "./components/auth/login";
import Register from "./components/auth/register";
import Home from "./components/home";
import User from "./components/users";
import CreateAccount from "./components/admin";
import Database from "./components/database";
import Store from "./components/store";
import Import from "./components/import";
import Payment from "./components/payment";

import { AuthProvider } from "./contexts/authContext";
import { useRoutes } from "react-router-dom";

function App() {
  const routesArray = [
    {
      path: "*",
      element: <Login />,
    },
    {
      path: "/login",
      element: <Login />,
    },
    {
      path: "/register",
      element: <Register />,
    },
    {
      path: "/home",
      element: <Home />,
    },
    {
      path: "/users",
      element: <User />,
    },
    {
      path: "/admin",
      element: <CreateAccount />,
    },
    {
      path: "/database",
      element: <Database />,
    },
    {
      path: "/import", // Add this new route
      element: <Import />,
    },
    {
      path: "/store",
      element: <Store />,
  },
  {
    path: "/payment",
    element: <Payment />,
  },
  ];
  let routesElement = useRoutes(routesArray);
  return (
    <AuthProvider>
      <div className="w-full h-screen flex flex-col">{routesElement}</div>
    </AuthProvider>
  );
}

export default App;
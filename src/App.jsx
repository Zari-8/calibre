import React from "react";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import Debates from "./pages/Debates.jsx";
import Players from "./pages/Players.jsx";
import Competitions from "./pages/Competitions.jsx";
import Talents from "./pages/Talents.jsx";
import SystemFit from "./pages/SystemFit.jsx";

const routes = {
  "/": Home,
  "/debates": Debates,
  "/players": Players,
  "/competitions": Competitions,
  "/talents": Talents,
  "/system-fit": SystemFit
};

export default function App() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const Page = routes[path] || Home;

  return (
    <div className="app-shell">
      <Navbar activePath={path} />
      <Page />
    </div>
  );
}

import { useEffect, useState } from "react";
import { API_URL } from "../config";
import { Link } from "react-router-dom";

import { CopperDivider } from "./Divider";
import * as Icons from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { EditProjectPopup } from "./Popup";

function SidebarItem({
    href,
    icon,
    name,
    color,
    collapsed,
    isProject = false,
    onClickFunction = null,
}) {
    const IconToUse = Icons[icon];
    // console.log("Rendering SidebarItem:", {
    //     href,
    //     icon,
    //     name,
    //     color,
    //     collapsed,
    //     isProject,
    // });
    return (
        <div
            className={`flex items-center transition ease-in-out hover:bg-dark/30 sidebaritem-outer ${
                collapsed
                    ? "justify-center p-2 rounded-3xl hover:text-rose-copper"
                    : "w-60 rounded ml-2 mr-2 p-2"
            }`}
        >
            <Link to={href} className="flex mr-auto">
                {icon && (
                    <IconToUse
                        className={`${!collapsed ? "mr-2" : ""}`}
                        color={color}
                    />
                )}
                {!collapsed && <span>{name}</span>}
            </Link>
            {!collapsed && isProject && (
                <button
                    className="text-dark sidebaritem-inner"
                    onClick={(event) => {
                        event.preventDefault();
                        if (typeof onClickFunction === "function") {
                            onClickFunction();
                        }
                    }}
                >
                    <Icons.MoreHorizontal />
                </button>
            )}
        </div>
    );
}

export default function Sidebar({
    projectPopupStatus = { open: false, project: null, openFunction: null, closeFunction: null },
    projects: projectsProp = null,
}) {
    const [collapsed, setCollapsed] = useState(false);
    const [pinned, setPinned] = useState(true);
    const [openProfilePopout, setOpenProfilePopout] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [pfp, setPfp] = useState("");

    const [projects, setProjects] = useState(projectsProp || null);
    const [localOpenEditPopup, setLocalOpenEditPopup] = useState(false);
    const [localProjectInPopup, setLocalProjectInPopup] = useState(null);

    const openEditPopup =
        typeof projectPopupStatus.open === "boolean"
            ? projectPopupStatus.open
            : localOpenEditPopup;
    const projectPopup =
        projectPopupStatus.project ?? localProjectInPopup;

    const { user, login, logout } = useAuth();

    // Get the user information
    async function fetchUserProfile() {
        try {
            const response = await fetch(`${API_URL}/me`, {
                credentials: "include",
            });
            const data = await response.json();
            if (data.success) {
                setFirstName(data.user.fname);
                setLastName(data.user.lname);
                setPfp(data.user.pfp);
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
        }
    }

    // Get the user's projects 
    async function fetchUserProjects(){
        try {
            const response = await fetch(`${API_URL}/projects`, {
                credentials: "include"
            });
            const data = await response.json();
            if (data.success) {
                setProjects(data.projects);
            }
        } catch (error) {
            console.error("Error fetching user projects:", error);
        }
    }

    useEffect(() => {
        fetchUserProfile();
        if (Array.isArray(projectsProp) && projectsProp.length > 0) {
            setProjects(projectsProp);
        } else {
            fetchUserProjects();
        }

        try {
            const stored = localStorage.getItem("sidebarPinned");
            if (stored !== null) {
                const p = stored === "true";
                setPinned(p);
                if (!p) setCollapsed(true);
            }
        } catch (err) {
            // ignore localStorage errors
        }
    }, [projectsProp]);

    const defaultColor = "#754B4D";

    return (
        <div id="sidebar">
            {openEditPopup && (
                <EditProjectPopup
                    project={projectPopup}
                    onClose={() => {
                        if (projectPopupStatus.closeFunction) {
                            projectPopupStatus.closeFunction();
                        } else {
                            setLocalOpenEditPopup(false);
                            setLocalProjectInPopup(null);
                        }
                        // refresh the projects list after popup closes
                        fetchUserProjects();
                    }}
                    onEdited={() => {
                        // let the page know an edit happened so it can refresh
                        if (projectPopupStatus.onEdited) {
                            projectPopupStatus.onEdited();
                        }
                        // close local popup if in local mode
                        setLocalOpenEditPopup(false);
                        setLocalProjectInPopup(null);
                        // also refresh locally
                        fetchUserProjects();
                    }}
                />
            )}
            <div
                className={`flex flex-col bg-rose-water text-rose-plum h-screen transition-all duration-300
      ${collapsed ? "w-16" : "w-64"}`}
                onMouseEnter={() => !pinned && setCollapsed(false)}
                onMouseLeave={() => !pinned && setCollapsed(true)}
            >
                <nav
                    className={`flex flex-col h-full ${
                        collapsed ? "items-center justify-between" : ""
                    }`}
                >
                    {/* HEADER */}
                    <div
                        className={`items-center justify-between ${
                            collapsed ? "p-2" : "p-4 flex"
                        }`}
                    >
                        {!collapsed && (
                            <h2 className="text-xl font-card main-header">
                                Menu
                            </h2>
                        )}
                        <button
                            onClick={() => {
                                const next = !pinned;
                                setPinned(next);
                                try {
                                    localStorage.setItem(
                                        "sidebarPinned",
                                        String(next),
                                    );
                                } catch (err) {
                                    // ignore localStorage errors
                                }
                                if (!next) setCollapsed(true);
                            }}
                            className="text-rose-plum hover:text-rose-copper hover:bg-dark/30 rounded-3xl focus:outline-none p-2"
                        >
                            {pinned ? <Icons.PinOff /> : <Icons.Pin />}
                        </button>
                        {/* Divider */}
                        {collapsed && <CopperDivider margins="mt-2" />}
                    </div>
                    {/* Dashboard */}
                    <SidebarItem
                        key="dashboard"
                        href="/dashboard"
                        collapsed={collapsed}
                        icon={"LayoutDashboard"}
                        name="Dashboard"
                        color={defaultColor}
                    />
                    {/* Feature Links */}
                    <div className="flex items-center justify-between p-2 mx-2">
                        {!collapsed && (
                            <div className="flex flex-col w-full">
                                <h2 className="main-header font-card">
                                    Features
                                </h2>
                                <CopperDivider />
                            </div>
                        )}
                    </div>
                    <SidebarItem
                        key="features"
                        href="/features"
                        collapsed={collapsed}
                        icon={"Sparkles"}
                        name="Feature guide"
                        color={defaultColor}
                    />
                    {/* Tool Links */}
                    <div className="flex items-center justify-between p-2 mx-2">
                        {!collapsed && (
                            <div className="flex flex-col w-full">
                                <h2 className="main-header font-card">
                                    Study Tools
                                </h2>
                                <CopperDivider />
                            </div>
                        )}
                    </div>
                    <SidebarItem
                        key="flashcards"
                        href="/flashcards"
                        collapsed={collapsed}
                        icon={"Layers"}
                        name="Flashcards"
                        color={defaultColor}
                    />
                    <SidebarItem
                        key="quizzes"
                        href="/quizzes"
                        collapsed={collapsed}
                        icon={"FileText"}
                        name="Quizzes"
                        color={defaultColor}
                    />
                    <SidebarItem
                        key="chats"
                        href="/chats"
                        collapsed={collapsed}
                        icon={"MessageSquare"}
                        name="Chatbot"
                        color={defaultColor}
                    />
                    {/* Projects */}
                    <div className="flex items-center justify-between p-2 mx-2">
                        {!collapsed && (
                            <div className="flex flex-col w-full">
                                <h2 className="main-header font-card">
                                    Projects
                                </h2>
                                <CopperDivider />
                            </div>
                        )}
                    </div>
                    {Array.isArray(projects) && projects.length > 0
                        ? projects.map((item) => (
                              <SidebarItem
                                  key={item.projectid || item.name}
                                  href={`/project/${item.projectid}`}
                                  icon={item.icon}
                                  name={item.name}
                                  collapsed={collapsed}
                                  color={item.color}
                                  isProject={true}
                                              onClickFunction={() => {
                                                  if (projectPopupStatus.openFunction) {
                                                      projectPopupStatus.openFunction(item);
                                                  } else {
                                                      setLocalProjectInPopup(item);
                                                      setLocalOpenEditPopup(true);
                                                  }
                                              }}
                              />
                          ))
                        : ""}
                    {/* Now at the bottom, we should have the user profile */}
                    <div className="mt-auto flex p-4 bg-rose-dusty/40">
                        {/* The popup that shows user options comes here which is inline of the sidebar*/}
                        {openProfilePopout && !collapsed && (
                            <div
                                className="absolute bottom-16 left-4 bg-rose-dusty/40 rounded p-4 w-48 z-10 border-2 border-rose-dusty/60 font-card"
                                onMouseLeave={() => setOpenProfilePopout(false)}
                            >
                                <a
                                    href="/profile"
                                    className="block px-4 py-2 hover:bg-dark/30 rounded"
                                >
                                    View Profile
                                </a>
                                <a
                                    href="/settings"
                                    className="block px-4 py-2 hover:bg-dark/30 rounded"
                                >
                                    Settings
                                </a>
                                <button
                                    onClick={() => {
                                        // Log the user out by calling the logout API
                                        logout();
                                        // Redirect to home page after a sleep timeout
                                        setTimeout(() => {
                                            window.location.href = "/";
                                        }, 500);
                                    }}
                                    className="block px-4 py-2 hover:bg-dark/30 rounded text-red-500"
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                        {/* Circle profile picture */}
                        <div
                            onClick={() =>
                                setOpenProfilePopout(!openProfilePopout)
                            }
                            className="flex items-center cursor-pointer"
                        >
                            <img
                                src={pfp}
                                alt={`${firstName.charAt(0)} ${lastName.charAt(0)}`}
                                className="rounded-full w-8 h-8 text-sm bg-dark text-accent text-center flex items-center justify-center main-header"
                            />
                            {!collapsed && (
                                <div className="text-center flex items-center justify-center ml-4 font-card">
                                    {`${firstName} ${lastName}`}
                                </div>
                            )}
                        </div>
                    </div>
                </nav>
            </div>
        </div>
    );
}

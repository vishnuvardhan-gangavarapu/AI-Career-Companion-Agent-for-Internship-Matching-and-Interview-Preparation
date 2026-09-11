import { useState } from "react"; 
import { NavLink, useNavigate } from "react-router-dom"; 

import { 
  LayoutDashboard, 
  UserCircle, 
  FileText, 
  BriefcaseBusiness, 
  Bookmark, 
  Target, 
  ClipboardList, 
  Settings, 
  LogOut, 
  LockKeyhole, 
  X, 
  AlertCircle, 
  Sparkles, 
  MessageCircle,
} from "lucide-react"; 

import "../../styles/DefaultSidebar.css"; 

function DefaultSidebar() { 
  const navigate = useNavigate(); 

  const [showWarning, setShowWarning] = useState(false); 

  const menuItems = [ 
    { 
      name: "Dashboard", 
      path: "/defaultDashboard", 
      icon: LayoutDashboard, 
      iconClass: "icon-dashboard", 
      accessible: true, 
    }, 

    { 
      name: "Profile", 
      path: "/defaultProfile", 
      icon: UserCircle, 
      iconClass: "icon-profile", 
      accessible: true, 
    }, 

    { 
      name: "Resume", 
      path: "/resume", 
      icon: FileText, 
      iconClass: "icon-resume", 
      accessible: true, 
    }, 

    { 
      name: "Preparation Agent", 
      path: "/preparation-agent", 
      icon: Sparkles, 
      iconClass: "icon-preparation", 
      accessible: false, 
    }, 

    { 
      name: "Preparation Chat", 
      path: "/preparation-chat", 
      icon: MessageCircle, 
      iconClass: "icon-preparation-chat", 
      accessible: false, 
    }, 

    { 
      name: "Internships", 
      path: "/internships", 
      icon: BriefcaseBusiness, 
      iconClass: "icon-internships", 
      accessible: true, 
    }, 

    { 
      name: "Saved Internships", 
      path: "/saved-internships", 
      icon: Bookmark, 
      iconClass: "icon-saved", 
      accessible: false, 
    }, 

    { 
      name: "Skill Gap", 
      path: "/skill-gap", 
      icon: Target, 
      iconClass: "icon-skill-gap", 
      accessible: false, 
    }, 

    { 
      name: "Applications", 
      path: "/applications", 
      icon: ClipboardList, 
      iconClass: "icon-applications", 
      accessible: false, 
    }, 

    { 
      name: "Settings", 
      path: "/settings", 
      icon: Settings, 
      iconClass: "icon-settings", 
      accessible: true, 
    }, 

    { 
      name: "Logout", 
      path: "/", 
      icon: LogOut, 
      iconClass: "icon-logout", 
      accessible: true, 
      logout: true, 
    }, 
  ]; 

  const handleLockedItem = () => { 
    setShowWarning(true); 

    window.clearTimeout(window.defaultSidebarWarningTimer); 

    window.defaultSidebarWarningTimer = window.setTimeout(() => { 
      setShowWarning(false); 
    }, 4000); 
  }; 

  const handleLogout = (event) => { 
    event.preventDefault(); 
    localStorage.removeItem("access_token"); 
    localStorage.removeItem("user"); 
    localStorage.removeItem("dashboard_type"); 
    navigate("/", { 
      replace: true, 
    }); 
  }; 

  return ( 
    <div className="default-sidebar-inner"> 

      <div className="sidebar-logo"> 
        <img src="/logo.png" alt="InternMatchAI" /> 
      </div> 

      <nav className="sidebar-navigation"> 
        {menuItems.map((item) => { 
          const Icon = item.icon; 

          if (!item.accessible) { 
            return ( 
              <button 
                key={item.path} 
                type="button" 
                className="sidebar-nav-item sidebar-locked-item" 
                onClick={handleLockedItem} 
                title={`${item.name} - Upload resume first`} 
                aria-label={`${item.name} is locked`} 
              > 
                <span className={`sidebar-nav-icon ${item.iconClass}`}> 
                  <Icon size={21} strokeWidth={2.2} /> 
                </span> 

                <span className="sidebar-nav-text">{item.name}</span> 

                <span className="sidebar-lock-icon"> 
                  <LockKeyhole size={14} strokeWidth={2.2} /> 
                </span> 
              </button> 
            ); 
          } 

          if (item.logout) { 
            return ( 
              <NavLink 
                key={item.name} 
                to="/" 
                title="Logout" 
                className="sidebar-nav-item sidebar-logout" 
                onClick={handleLogout} 
              > 
                <span className={`sidebar-nav-icon ${item.iconClass}`}> 
                  <Icon size={21} strokeWidth={2.2} /> 
                </span> 

                <span className="sidebar-nav-text">Logout</span> 
              </NavLink> 
            ); 
          } 

          return ( 
            <NavLink 
              key={item.path} 
              to={item.path} 
              title={item.name} 
              className={({ isActive }) => 
                `sidebar-nav-item ${isActive ? "active" : ""}` 
              } 
            > 
              <span className={`sidebar-nav-icon ${item.iconClass}`}> 
                <Icon size={21} strokeWidth={2.2} /> 
              </span> 

              <span className="sidebar-nav-text">{item.name}</span> 

              <span className="sidebar-active-indicator" /> 
            </NavLink> 
          ); 
        })} 
      </nav> 

      {showWarning && ( 
        <div className="sidebar-warning"> 
          <div className="sidebar-warning-icon"> 
            <AlertCircle size={19} strokeWidth={2.2} /> 
          </div> 

          <div className="sidebar-warning-content"> 
            <strong>Resume required</strong> 

            <p>Upload and analyze your resume first to access this feature.</p> 
          </div> 

          <button 
            type="button" 
            className="sidebar-warning-close" 
            onClick={() => setShowWarning(false)} 
            aria-label="Close warning" 
          > 
            <X size={16} strokeWidth={2.2} /> 
          </button> 
        </div> 
      )} 
    </div> 
  ); 
} 

export default DefaultSidebar; 

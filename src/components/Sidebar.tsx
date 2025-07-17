
import { NavLink } from 'react-router-dom';
import { FaSearch, FaMusic, FaCog } from 'react-icons/fa';
import './Sidebar.css';

function Sidebar() {
  return (
    <nav className="sidebar">
      <NavLink to="/search" className="sidebar-link">
        <FaSearch className="sidebar-icon" />
        <span>Search</span>
      </NavLink>
      <NavLink to="/library" className="sidebar-link">
        <FaMusic className="sidebar-icon" />
        <span>Library</span>
      </NavLink>
      <NavLink to="/settings" className="sidebar-link">
        <FaCog className="sidebar-icon" />
        <span>Settings</span>
      </NavLink>
    </nav>
  );
}

export default Sidebar;

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../client";
import Card from "../components/card";
import "./MyPolipions.css";

const MyPolipions = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    if (user) {
      fetchMyPolipions();
    }
  }, [user, sortBy]);

  const fetchMyPolipions = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("stata_issues")
        .select("*")
        .eq("username", user.username);

      // Apply sorting
      switch (sortBy) {
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'resolved':
          query = query.order('is_resolved', { ascending: false }).order('created_at', { ascending: false });
          break;
        case 'unresolved':
          query = query.order('is_resolved', { ascending: true }).order('created_at', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching my STATA issues:", error);
      } else {
        setPosts(data || []);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
  };

  if (loading) {
    return (
      <div className="my-polipions-container">
        <div className="loading-container">
          <h2>Loading your STATA issues...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="my-polipions-container">
      <div className="my-polipions-header">
        <h1>My STATA Issues</h1>
        <p className="user-stats">
          You have reported <strong>{posts.length}</strong> issue{posts.length !== 1 ? 's' : ''}
        </p>
        
        <div className="controls-section">
          <div className="sort-controls">
            <label htmlFor="sort-select">Sort by:</label>
            <select 
              id="sort-select" 
              value={sortBy} 
              onChange={handleSortChange}
              className="sort-select"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="resolved">Resolved First</option>
              <option value="unresolved">Unresolved First</option>
            </select>
          </div>
          
          <Link to="/new" className="add-polipion-btn">
            ➕ Report New Error
          </Link>
        </div>
      </div>

      {posts && posts.length > 0 ? (
        <div className="my-polipions-list">
          {posts.map((post) => (
            <Card
              key={post.id}
              id={post.id}
              command={post.command}
              error_category={post.error_category}
              description={post.description}
              created_at={post.created_at}
              image_url={post.image_url}
              username={post.username}
              is_resolved={post.is_resolved}
            />
          ))}
        </div>
      ) : (
        <div className="no-polipions">
          <h2>No Issues Yet</h2>
          <p>You haven't reported any STATA errors yet. Report your first issue!</p>
          <Link to="/new" className="add-polipion-btn">
            ➕ Report Your First Error
          </Link>
        </div>
      )}
    </div>
  );
};

export default MyPolipions;

import { useState, useEffect } from "react";
import Card from "../components/card";
import { supabase } from "../client";
import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import "./seePolipions.css";

const SeePolipions = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('created_at');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const location = useLocation();

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchPosts();
  }, [location.pathname, sortBy, debouncedSearchTerm]);


  useEffect(() => {
    const handleFocus = () => {
      fetchPosts();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  
  const fetchPosts = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from("stata_issues")
        .select("*");

      // Apply search filter if search term exists (search by command and description)
      if (debouncedSearchTerm.trim()) {
        query = query.or(`command.ilike.%${debouncedSearchTerm}%,description.ilike.%${debouncedSearchTerm}%`);
      }

      // Apply sorting
      if (sortBy === 'created_at') {
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'is_resolved') {
        query = query.order('is_resolved', { ascending: true }).order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching STATA issues:", error);
        setPosts([]);
      } else {
        setPosts(data || []);
      }
    } catch (error) {
      alert("Unexpected error loading STATA issues: " + error.message);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <h2>Loading STATA issues...</h2>
      </div>
    );
  }

  return (
    <div className="ReadPosts">
      <div className="controls-section" style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-control">
          <label htmlFor="search" className="control-label">Search:</label>
          <input
            id="search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by command or description..."
            className="control-input"
          />
        </div>

        <div className="sort-control">
          <label htmlFor="sort" className="control-label">Sort by:</label>
          <select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="control-select"
          >
            <option value="created_at">Newest First</option>
            <option value="is_resolved">Unsolved First</option>
          </select>
        </div>

        <button
          onClick={fetchPosts}
          className="refresh-btn"
        >
          Refresh
        </button>
      </div>
      
      {posts && posts.length > 0 ? (
        <div className="forum-posts-list">
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
          <h2>No STATA issues to display</h2>
          <p>No errors have been reported yet. Be the first to share an issue!</p>
          <Link to="/new">
            <button className="add-polipion-btn">
              Report Your First Error
            </button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default SeePolipions;

import "./card.css";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../client";
import { deleteIssueImageByUrl } from "../utils/storage";

const Card = (props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const deletePolipion = async () => {
    if (window.confirm('Are you sure you want to delete this STATA issue?')) {
      try {
        if (props.image_url) {
          const { error: deleteError } = await deleteIssueImageByUrl(props.image_url);
          if (deleteError) {
            console.error("Error deleting image:", deleteError);
          }
        }

        // First delete associated comments
        await supabase
          .from("comments")
          .delete()
          .eq("issue_id", props.id);

        // Then delete the issue
        const { error } = await supabase
          .from("stata_issues")
          .delete()
          .eq("id", props.id);

        if (error) {
          console.error("Error deleting STATA issue:", error);
          alert("Error deleting STATA issue: " + error.message);
          return;
        }

        // If we're on the issue detail page, navigate to issues list
        if (location.pathname.includes(`/polipion/${props.id}`)) {
          navigate('/polipions');
        } else {
          // Otherwise just reload the current page
          window.location.reload();
        }
      } catch (error) {
        console.error("Unexpected error:", error);
        alert("Unexpected error occurred: " + error.message);
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Determine border and background styling based on status
  const getBorderStyle = () => {
    if (props.is_resolved) {
      return '1px solid #10b981'; // Green border for resolved
    } else if (user && user.username === props.username) {
      return '2px solid #f59e0b'; // Orange border for user's own posts
    } else {
      return '1px solid var(--card-border)'; // Default border
    }
  };

  const getBackgroundStyle = () => {
    if (props.is_resolved) {
      return 'rgba(16, 185, 129, 0.1)'; // Light green background for resolved (10% opacity)
    } else {
      return 'var(--card-bg)'; // Default background
    }
  };

  return (
    <div className="forum-card" style={{
      border: getBorderStyle(),
      backgroundColor: getBackgroundStyle(),
      padding: '16px'
    }}>
      {/* Header with metadata */}
      <div className="forum-card-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        fontSize: '0.875rem',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span>@{props.username}</span>
          <span>•</span>
          <span>{formatDate(props.created_at)}</span>
          {props.is_resolved && (
            <>
              <span>•</span>
              <span style={{
                backgroundColor: '#10b981',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                ✓ Resolved
              </span>
            </>
          )}
        </div>
        {user && user.username === props.username && !props.is_resolved && (
          <div className="card-actions">
            <Link to={`/edit/${props.id}`}>
              <button className="edit-btn">✏️</button>
            </Link>
            <button className="delete-btn" onClick={deletePolipion}>🗑️</button>
          </div>
        )}
      </div>

      <Link to={`/polipion/${props.id}`} className="forum-card-link" style={{ textDecoration: 'none' }}>
        <div className="forum-card-content">
          {/* Reddit-style title */}
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            marginBottom: '12px',
            color: 'var(--text-color)',
            lineHeight: '1.4'
          }}>
            {props.title || 'Untitled Issue'}
          </h3>

          {/* Description preview */}
          <p style={{
            fontSize: '0.95rem',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            marginBottom: '12px',
            lineHeight: '1.5'
          }}>
            {props.description}
          </p>

          {/* Tags and voting */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            alignItems: 'center', 
            flexWrap: 'wrap',
            marginTop: '12px'
          }}>
            {/* Voting */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                ⬆ {props.upvotes || 0}
              </span>
              <span style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                ⬇ {props.downvotes || 0}
              </span>
            </div>

            {/* Command badge */}
            <span style={{
              fontFamily: 'monospace',
              backgroundColor: 'var(--bg-secondary)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.8rem',
              fontWeight: '600',
              color: 'var(--text-color)'
            }}>
              💻 {props.command}
            </span>

            {/* Error category badge */}
            <span style={{
              backgroundColor: '#4f46e5',
              color: 'white',
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '500'
            }}>
              {props.error_category}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default Card;

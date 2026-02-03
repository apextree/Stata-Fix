import "./card.css";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../client";

const Card = (props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const deletePolipion = async () => {
    if (window.confirm('Are you sure you want to delete this STATA issue?')) {
      try {
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

  return (
    <div className="forum-card" style={{
      border: props.is_resolved ? '2px solid #10b981' : '1px solid var(--card-border)'
    }}>
      <div className="forum-card-header">
        <span className="upload-date">{formatDate(props.created_at)}</span>
        <span className="post-author">by @{props.username}</span>
        {props.is_resolved && (
          <span style={{
            backgroundColor: '#10b981',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            ✓ Resolved
          </span>
        )}
        {user && user.username === props.username && !props.is_resolved && (
          <div className="card-actions">
            <Link to={`/edit/${props.id}`}>
              <button className="edit-btn">✏️</button>
            </Link>
            <button className="delete-btn" onClick={deletePolipion}>🗑️</button>
          </div>
        )}
      </div>

      <Link to={`/polipion/${props.id}`} className="forum-card-link">
        <div className="forum-card-content">
          <div className="forum-card-footer" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'monospace',
                backgroundColor: '#f3f4f6',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#1e293b'
              }}>
                💻 {props.command}
              </span>
              <span style={{
                backgroundColor: '#4f46e5',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '500'
              }}>
                {props.error_category}
              </span>
            </div>
          </div>

          <div className="description-preview" style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            {props.description}
          </div>
        </div>
      </Link>
    </div>
  );
};

export default Card;

import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../client";
import "./PolipionDetails.css";

const PolipionDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [polipion, setPolipion] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchPolipion();
    fetchComments();
  }, [id]);

  const fetchPolipion = async () => {
    try {
      const { data, error } = await supabase
        .from("stata_issues")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching STATA issue:", error);
        if (error.code === 'PGRST116') {
          setNotFound(true);
        }
      } else {
        setPolipion(data);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("issue_id", id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching comments:", error);
      } else {
        setComments(data || []);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
    }
  };

  const handleMarkAsFix = async (commentId, commentAuthorId) => {
    if (!user || user.id !== polipion.user_id) {
      alert("Only the issue author can mark a fix");
      return;
    }

    if (window.confirm("Mark this comment as the verified fix?")) {
      try {
        // Update the comment to mark it as verified fix
        const { error: commentError } = await supabase
          .from("comments")
          .update({ is_verified_fix: true })
          .eq("id", commentId);

        if (commentError) throw commentError;

        // Update the issue to mark it as resolved
        const { error: issueError } = await supabase
          .from("stata_issues")
          .update({ is_resolved: true })
          .eq("id", id);

        if (issueError) throw issueError;

        // Add points to the commenter (+5 for accepted fix)
        const { error: pointError } = await supabase
          .from("point_ledger")
          .insert({
            user_id: commentAuthorId,
            points_change: 5,
            reason: 'ACCEPTED_FIX'
          });

        if (pointError) throw pointError;

        // Update commenter's cumulative points
        const { data: commenterProfile } = await supabase
          .from("profiles")
          .select("cumulative_points")
          .eq("id", commentAuthorId)
          .single();

        if (commenterProfile) {
          await supabase
            .from("profiles")
            .update({ 
              cumulative_points: (commenterProfile.cumulative_points || 0) + 5 
            })
            .eq("id", commentAuthorId);
        }

        // Refresh data
        fetchPolipion();
        fetchComments();
        alert("Comment marked as the verified fix! +5 points awarded.");
      } catch (error) {
        console.error("Error marking as fix:", error);
        alert("Error marking as fix: " + error.message);
      }
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!user) {
      alert("Please log in to comment");
      return;
    }

    setSubmittingComment(true);
    try {
      // Insert comment into comments table
      const { data: commentData, error: commentError } = await supabase
        .from("comments")
        .insert({
          issue_id: id,
          user_id: user.id,
          username: user.username,
          comment_text: newComment.trim(),
          is_verified_fix: false
        })
        .select()
        .single();

      if (commentError) {
        console.error("Error adding comment:", commentError);
        alert("Error adding comment: " + commentError.message);
        return;
      }

      // Add points to point_ledger (+3 for suggestion)
      const { error: pointError } = await supabase
        .from("point_ledger")
        .insert({
          user_id: user.id,
          points_change: 3,
          reason: 'SUGGESTION'
        });

      if (pointError) {
        console.error("Error adding points:", pointError);
      }

      // Update user's cumulative points
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          cumulative_points: (user.cumulative_points || 0) + 3 
        })
        .eq("id", user.id);

      if (profileError) {
        console.error("Error updating profile points:", profileError);
      }

      // Refresh comments
      fetchComments();
      setNewComment('');
    } catch (error) {
      console.error("Unexpected error:", error);
      alert("Unexpected error occurred: " + error.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <h2>Loading STATA issue details...</h2>
      </div>
    );
  }

  if (notFound || (!loading && !polipion)) {
    return (
      <div className="error-container">
        <h2>STATA Issue not found</h2>
        <p>This issue may have been deleted or doesn't exist.</p>
        <div className="error-actions">
          <Link to="/polipions">
            <button className="back-btn">Back to All Issues</button>
          </Link>
          <Link to="/">
            <button className="home-btn">Go Home</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="polipion-details-container">
      <div className="polipion-details-card">
        <div className="polipion-details-header">
          <Link to="/polipions" className="back-link">
            ← Back to All Issues
          </Link>
          {user && user.id === polipion.user_id && !polipion.is_resolved && (
            <Link to={`/edit/${polipion.id}`} className="edit-link">
              Edit Issue
            </Link>
          )}
          {polipion.is_resolved && (
            <span className="resolved-badge" style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}>
              ✓ Resolved
            </span>
          )}
        </div>

        <div className="polipion-details-content">
          {polipion.image_url && (
            <div className="polipion-details-image">
              <img
                src={polipion.image_url}
                alt="STATA error screenshot"
                className="details-polipion-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}

          <div className="polipion-info">
            <div className="polipion-meta">
              <p className="creation-date">
                <span className="meta-label">📅 Posted:</span> {formatDate(polipion.created_at)}
              </p>
              <p className="post-author">
                <span className="meta-label">👤 By:</span> @{polipion.username}
              </p>
            </div>

            <div className="polipion-stats">
              <div className="stat-item">
                <span className="stat-label">Command:</span>
                <span className="stat-value" style={{
                  fontFamily: 'monospace',
                  backgroundColor: '#f3f4f6',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}>{polipion.command}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Error Category:</span>
                <span className="stat-value party-badge" style={{
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '14px'
                }}>{polipion.error_category}</span>
              </div>
            </div>

            <div className="polipion-opinion">
              <h3>Error Description</h3>
              <div className="opinion-text">
                <p>{polipion.description}</p>
              </div>
            </div>

            <div className="comments-section">
              <h3>Solutions & Suggestions ({comments.length})</h3>

              {user && !polipion.is_resolved && (
                <form onSubmit={handleAddComment} className="add-comment-form">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Suggest a solution... (+3 points)"
                    rows="3"
                    className="comment-input"
                    disabled={submittingComment}
                  />
                  <button
                    type="submit"
                    className="submit-comment-btn"
                    disabled={submittingComment || !newComment.trim()}
                  >
                    {submittingComment ? "Adding..." : "Add Suggestion (+3 points)"}
                  </button>
                </form>
              )}

              {!user && (
                <p className="login-prompt" style={{ marginBottom: '20px' }}>
                  <Link to="/login">Login</Link> to suggest solutions and earn points
                </p>
              )}

              <div className="comments-list">
                {comments && comments.length > 0 ? (
                  comments.map((comment) => (
                    <div key={comment.id} className="comment-item" style={{
                      border: comment.is_verified_fix ? '2px solid #10b981' : '1px solid #e2e8f0',
                      backgroundColor: comment.is_verified_fix ? '#f0fdf4' : 'white'
                    }}>
                      <div className="comment-header">
                        <span className="comment-author">
                          {comment.username}
                          {comment.is_verified_fix && (
                            <span style={{
                              marginLeft: '8px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}>✓ Verified Fix</span>
                          )}
                        </span>
                        <span className="comment-date">{formatDate(comment.created_at)}</span>
                      </div>
                      <div className="comment-text">{comment.comment_text}</div>
                      {user && user.id === polipion.user_id && !polipion.is_resolved && !comment.is_verified_fix && (
                        <button
                          onClick={() => handleMarkAsFix(comment.id, comment.user_id)}
                          style={{
                            marginTop: '10px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Mark as The Fix (+5 points to author)
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="no-comments">No suggestions yet. Be the first to help!</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolipionDetails;
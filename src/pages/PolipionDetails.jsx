import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../client";
import "./PolipionDetails.css";

const PolipionDetails = () => {
  const { id } = useParams();
  const { user, refreshUserPoints } = useAuth();
  const navigate = useNavigate();
  const [polipion, setPolipion] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [userVote, setUserVote] = useState(null);
  const [commentVotes, setCommentVotes] = useState({});

  useEffect(() => {
    fetchPolipion();
    fetchComments();
    if (user) {
      fetchUserVotes();
    }
  }, [id, user]);

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
        .order("upvotes", { ascending: false });

      if (error) {
        console.error("Error fetching comments:", error);
      } else {
        setComments(data || []);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
    }
  };

  const fetchUserVotes = async () => {
    if (!user) return;
    
    try {
      // Get user's vote on the issue
      const { data: issueVote } = await supabase
        .from("user_votes")
        .select("vote_type")
        .eq("user_id", user.id)
        .eq("target_id", id)
        .eq("target_type", "issue")
        .maybeSingle();

      if (issueVote) {
        setUserVote(issueVote.vote_type);
      }

      // Get user's votes on comments
      const { data: commentVotesList } = await supabase
        .from("user_votes")
        .select("target_id, vote_type")
        .eq("user_id", user.id)
        .eq("target_type", "comment");

      if (commentVotesList) {
        const votesMap = {};
        commentVotesList.forEach(vote => {
          votesMap[vote.target_id] = vote.vote_type;
        });
        setCommentVotes(votesMap);
      }
    } catch (error) {
      console.error("Error fetching user votes:", error);
    }
  };

  const handleVote = async (voteType) => {
    if (!user) {
      alert("Please log in to vote");
      return;
    }

    try {
      const isUpvote = voteType === 'upvote';
      const currentVote = userVote;

      // Remove existing vote if clicking same button
      if (currentVote === voteType) {
        await supabase
          .from("user_votes")
          .delete()
          .eq("user_id", user.id)
          .eq("target_id", id)
          .eq("target_type", "issue");

        // Update counts
        const newUpvotes = isUpvote ? (polipion.upvotes || 0) - 1 : (polipion.upvotes || 0);
        const newDownvotes = !isUpvote ? (polipion.downvotes || 0) - 1 : (polipion.downvotes || 0);
        
        await supabase
          .from("stata_issues")
          .update({ upvotes: newUpvotes, downvotes: newDownvotes })
          .eq("id", id);

        setPolipion(prev => ({ ...prev, upvotes: newUpvotes, downvotes: newDownvotes }));
        setUserVote(null);
      } else {
        // Update or insert vote
        await supabase
          .from("user_votes")
          .upsert({
            user_id: user.id,
            target_id: id,
            target_type: "issue",
            vote_type: voteType
          }, { onConflict: 'user_id,target_id,target_type' });

        // Update counts
        let newUpvotes = polipion.upvotes || 0;
        let newDownvotes = polipion.downvotes || 0;

        if (currentVote === 'upvote') newUpvotes--;
        if (currentVote === 'downvote') newDownvotes--;
        if (isUpvote) newUpvotes++;
        else newDownvotes++;

        await supabase
          .from("stata_issues")
          .update({ upvotes: newUpvotes, downvotes: newDownvotes })
          .eq("id", id);

        setPolipion(prev => ({ ...prev, upvotes: newUpvotes, downvotes: newDownvotes }));
        setUserVote(voteType);
      }
    } catch (error) {
      console.error("Error voting:", error);
      alert("Error voting: " + error.message);
    }
  };

  const handleCommentVote = async (commentId, voteType) => {
    if (!user) {
      alert("Please log in to vote");
      return;
    }

    try {
      const isUpvote = voteType === 'upvote';
      const currentVote = commentVotes[commentId];
      const comment = comments.find(c => c.id === commentId);

      // Remove existing vote if clicking same button
      if (currentVote === voteType) {
        await supabase
          .from("user_votes")
          .delete()
          .eq("user_id", user.id)
          .eq("target_id", commentId)
          .eq("target_type", "comment");

        // Update counts
        const newUpvotes = isUpvote ? (comment.upvotes || 0) - 1 : (comment.upvotes || 0);
        const newDownvotes = !isUpvote ? (comment.downvotes || 0) - 1 : (comment.downvotes || 0);
        
        await supabase
          .from("comments")
          .update({ upvotes: newUpvotes, downvotes: newDownvotes })
          .eq("id", commentId);

        setComments(prev => prev.map(c => 
          c.id === commentId ? { ...c, upvotes: newUpvotes, downvotes: newDownvotes } : c
        ));
        setCommentVotes(prev => ({ ...prev, [commentId]: null }));
      } else {
        // Update or insert vote
        await supabase
          .from("user_votes")
          .upsert({
            user_id: user.id,
            target_id: commentId,
            target_type: "comment",
            vote_type: voteType
          }, { onConflict: 'user_id,target_id,target_type' });

        // Update counts
        let newUpvotes = comment.upvotes || 0;
        let newDownvotes = comment.downvotes || 0;

        if (currentVote === 'upvote') newUpvotes--;
        if (currentVote === 'downvote') newDownvotes--;
        if (isUpvote) newUpvotes++;
        else newDownvotes++;

        await supabase
          .from("comments")
          .update({ upvotes: newUpvotes, downvotes: newDownvotes })
          .eq("id", commentId);

        setComments(prev => prev.map(c => 
          c.id === commentId ? { ...c, upvotes: newUpvotes, downvotes: newDownvotes } : c
        ));
        setCommentVotes(prev => ({ ...prev, [commentId]: voteType }));
      }
    } catch (error) {
      console.error("Error voting on comment:", error);
      alert("Error voting: " + error.message);
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

  const handleSelfResolve = async () => {
    if (!user || user.id !== polipion.user_id) {
      alert("Only the issue author can mark as resolved");
      return;
    }

    if (window.confirm("Mark this issue as resolved? (You figured it out yourself)")) {
      try {
        // Update the issue to mark it as resolved
        const { error: issueError } = await supabase
          .from("stata_issues")
          .update({ is_resolved: true })
          .eq("id", id);

        if (issueError) throw issueError;

        // Refresh data
        fetchPolipion();
        alert("Issue marked as resolved!");
      } catch (error) {
        console.error("Error marking as resolved:", error);
        alert("Error marking as resolved: " + error.message);
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

      // Only award points if NOT commenting on own post
      const isOwnPost = user.id === polipion.user_id;
      
      if (!isOwnPost) {
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

        // Refresh user points
        await refreshUserPoints();
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
            {/* Reddit-style title */}
            <h2 className="polipion-details-title" style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              marginBottom: '12px',
              color: 'var(--text-color)'
            }}>
              {polipion.title || 'Untitled Issue'}
            </h2>

            {/* Small metadata */}
            <div className="polipion-meta" style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <span>Posted by @{polipion.username}</span>
              <span>•</span>
              <span>{formatDate(polipion.created_at)}</span>
            </div>

            {/* Voting and Stats */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
              {/* Voting buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleVote('upvote')}
                  disabled={!user}
                  style={{
                    background: userVote === 'upvote' ? '#4f46e5' : 'transparent',
                    color: userVote === 'upvote' ? 'white' : 'var(--text-secondary)',
                    border: '2px solid var(--border-color)',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    cursor: user ? 'pointer' : 'not-allowed',
                    fontSize: '1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ⬆ {polipion.upvotes || 0}
                </button>
                <button
                  onClick={() => handleVote('downvote')}
                  disabled={!user}
                  style={{
                    background: userVote === 'downvote' ? '#ef4444' : 'transparent',
                    color: userVote === 'downvote' ? 'white' : 'var(--text-secondary)',
                    border: '2px solid var(--border-color)',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    cursor: user ? 'pointer' : 'not-allowed',
                    fontSize: '1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ⬇ {polipion.downvotes || 0}
                </button>
              </div>

              {/* Command and category badges */}
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
                  💻 {polipion.command}
                </span>
                <span style={{
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {polipion.error_category}
                </span>
              </div>
            </div>

            {/* Reddit-style description */}
            <div className="polipion-opinion" style={{ marginTop: '20px' }}>
              <p style={{
                fontSize: '1rem',
                lineHeight: '1.6',
                color: 'var(--text-color)',
                marginBottom: '20px'
              }}>
                {polipion.description}
              </p>
            </div>

            <div className="comments-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>Solutions & Suggestions ({comments.length})</h3>
                
                {/* Self-resolve button for issue author */}
                {user && user.id === polipion.user_id && !polipion.is_resolved && (
                  <button
                    onClick={handleSelfResolve}
                    style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}
                  >
                    ✓ Mark as Resolved (Figured it out)
                  </button>
                )}
              </div>

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
                      backgroundColor: comment.is_verified_fix ? '#f0fdf4' : 'white',
                      padding: '16px',
                      marginBottom: '12px',
                      borderRadius: '8px'
                    }}>
                      <div className="comment-header" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)'
                      }}>
                        <span className="comment-author">
                          @{comment.username}
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
                      <div className="comment-text" style={{ marginBottom: '12px', fontSize: '1rem' }}>
                        {comment.comment_text}
                      </div>
                      
                      {/* Comment voting */}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => handleCommentVote(comment.id, 'upvote')}
                            disabled={!user}
                            style={{
                              background: commentVotes[comment.id] === 'upvote' ? '#4f46e5' : 'transparent',
                              color: commentVotes[comment.id] === 'upvote' ? 'white' : 'var(--text-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: user ? 'pointer' : 'not-allowed',
                              fontSize: '0.9rem'
                            }}
                          >
                            ⬆ {comment.upvotes || 0}
                          </button>
                          <button
                            onClick={() => handleCommentVote(comment.id, 'downvote')}
                            disabled={!user}
                            style={{
                              background: commentVotes[comment.id] === 'downvote' ? '#ef4444' : 'transparent',
                              color: commentVotes[comment.id] === 'downvote' ? 'white' : 'var(--text-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: user ? 'pointer' : 'not-allowed',
                              fontSize: '0.9rem'
                            }}
                          >
                            ⬇ {comment.downvotes || 0}
                          </button>
                        </div>

                        {user && user.id === polipion.user_id && !polipion.is_resolved && !comment.is_verified_fix && comment.user_id !== user.id && (
                          <button
                            onClick={() => handleMarkAsFix(comment.id, comment.user_id)}
                            style={{
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.875rem'
                            }}
                          >
                            Mark as The Fix (+5 pts)
                          </button>
                        )}
                      </div>
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
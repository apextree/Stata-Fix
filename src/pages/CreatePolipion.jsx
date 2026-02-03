import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./createPolipion.css";
import { supabase } from "../client";

const CreatePolipion = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState({
    post_title: "",
    command: "",
    error_category: "",
    description: "",
    image_url: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setPost((prev) => {
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const createPost = async (event) => {
    event.preventDefault();

    if (!post.post_title || !post.command || !post.error_category || !post.description) {
      alert("Please fill in all required fields!");
      return;
    }

    setLoading(true);

    try {
      console.log("Creating STATA Issue:", post);

      // Insert the STATA issue
      const { data: issueData, error: issueError } = await supabase
        .from("stata_issues")
        .insert({
          user_id: user.id,
          username: user.username,
          command: post.command,
          error_category: post.error_category,
          description: post.description,
          image_url: post.image_url || null,
          is_resolved: false
        })
        .select()
        .single();

      if (issueError) {
        console.error("Error creating STATA issue:", issueError);
        alert("Error creating STATA issue: " + issueError.message);
        setLoading(false);
        return;
      }

      // Add points to the point_ledger (+5 for posting an error)
      const { error: pointError } = await supabase
        .from("point_ledger")
        .insert({
          user_id: user.id,
          points_change: 5,
          reason: 'POST_ERROR'
        });

      if (pointError) {
        console.error("Error adding points:", pointError);
      }

      // Update user's cumulative points
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          cumulative_points: (user.cumulative_points || 0) + 5 
        })
        .eq("id", user.id);

      if (profileError) {
        console.error("Error updating profile points:", profileError);
      }

      console.log("STATA issue created successfully:", issueData);

      setPost({
        post_title: "",
        command: "",
        error_category: "",
        description: "",
        image_url: "",
      });

      setTimeout(() => {
        navigate("/polipions");
      }, 500);

    } catch (error) {
      console.error("Unexpected error:", error);
      alert("Unexpected error occurred: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-polipion-container">
      <div className="create-form-wrapper">
        <h1>Report a STATA Error</h1>
        <div className="polipion-preview">
          <p>Encountered a STATA error? Share it here and get help from the community! (+5 points)</p>
        </div>

        <form className="create-form" onSubmit={createPost}>
          <div className="form-group">
            <label htmlFor="post_title">Issue Title *</label>
            <input
              type="text"
              value={post.post_title}
              id="post_title"
              name="post_title"
              onChange={handleChange}
              placeholder="Brief title describing your issue"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="command">STATA Command *</label>
            <input
              type="text"
              value={post.command}
              id="command"
              name="command"
              onChange={handleChange}
              placeholder="e.g., regress, summarize, merge"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="error_category">Error Category *</label>
            <select
              value={post.error_category}
              id="error_category"
              name="error_category"
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '16px',
                fontFamily: 'inherit'
              }}
            >
              <option value="">Select an error category</option>
              <option value="Syntax Error">Syntax Error</option>
              <option value="Data Error">Data Error</option>
              <option value="Variable Not Found">Variable Not Found</option>
              <option value="Type Mismatch">Type Mismatch</option>
              <option value="Memory Error">Memory Error</option>
              <option value="File I/O Error">File I/O Error</option>
              <option value="Logic Error">Logic Error</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Error Description *</label>
            <textarea
              value={post.description}
              id="description"
              name="description"
              onChange={handleChange}
              placeholder="Describe the error, what you were trying to do, and any error messages you received..."
              required
              rows="6"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '16px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="image_url">Screenshot URL (optional)</label>
            <input
              type="url"
              value={post.image_url}
              id="image_url"
              name="image_url"
              onChange={handleChange}
              placeholder="https://example.com/screenshot.jpg"
            />
          </div>

          <button
            type="submit"
            className="create-btn"
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit Error Report"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreatePolipion;

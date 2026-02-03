import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./editPolipion.css";
import { supabase } from "../client";

const EditPolipion = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState({
    id: null,
    title: "",
    command: "",
    error_category: "",
    description: "",
    image_url: "",
    username: "",
    user_id: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    const { data } = await supabase
      .from("stata_issues")
      .select()
      .eq("id", id)
      .single();

    if (data) {
      // Check if user owns this issue
      if (user && data.user_id !== user.id) {
        alert("You can only edit your own issues");
        navigate("/polipions");
        return;
      }
      setPost(data);
    }
    setLoading(false);
  };

  const updatePost = async (event) => {
    event.preventDefault();

    if (!post.title || !post.command || !post.error_category || !post.description) {
      alert("Please fill in all required fields!");
      return;
    }

    try {
      const { error } = await supabase
        .from("stata_issues")
        .update({
          title: post.title,
          command: post.command,
          error_category: post.error_category,
          description: post.description,
          image_url: post.image_url || null,
        })
        .eq("id", id);

      if (error) {
        console.error("Error updating STATA issue:", error);
        alert("Error updating STATA issue: " + error.message);
        return;
      }

      navigate("/polipions");
    } catch (error) {
      console.error("Unexpected error:", error);
      alert("Unexpected error occurred: " + error.message);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setPost((prev) => {
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const deletePolipion = async (event) => {
    event.preventDefault();

    if (window.confirm('Are you sure you want to delete this STATA issue?')) {
      try {
        // First delete associated comments
        await supabase
          .from("comments")
          .delete()
          .eq("issue_id", id);

        // Then delete the issue
        const { error } = await supabase.from("stata_issues").delete().eq("id", id);
        if (error) {
          console.error("Error deleting STATA issue:", error);
          alert("Error deleting STATA issue: " + error.message);
          return;
        }
        navigate("/polipions");
      } catch (error) {
        console.error("Unexpected error:", error);
        alert("Unexpected error occurred: " + error.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <h2>Loading STATA issue data...</h2>
      </div>
    );
  }

  return (
    <div className="edit-polipion-container">
      <div className="edit-form-wrapper">
        <h1>Edit STATA Issue</h1>

        <form className="edit-form">
          <div className="form-group">
            <label htmlFor="title">Issue Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={post.title}
              onChange={handleChange}
              placeholder="Brief title describing your issue"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="command">STATA Command *</label>
            <input
              type="text"
              id="command"
              name="command"
              value={post.command}
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
              id="description"
              name="description"
              value={post.description}
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
              id="image_url"
              name="image_url"
              value={post.image_url}
              onChange={handleChange}
              placeholder="https://example.com/screenshot.jpg"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="update-btn" onClick={updatePost}>
              ✅ Update Issue
            </button>
            <button type="button" className="delete-btn" onClick={deletePolipion}>
              🗑️ Delete Issue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPolipion;

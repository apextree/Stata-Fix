import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./editPolipion.css";
import { supabase } from "../client";
import { uploadIssueImage, deleteIssueImageByUrl, resolveIssueImageUrl } from "../utils/storage";

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
  const [newImageFile, setNewImageFile] = useState(null);

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
      let imageUrlToSave = post.image_url || null;

      if (newImageFile) {
        const { publicUrl, error: uploadError } = await uploadIssueImage(newImageFile, post.user_id);
        if (uploadError) {
          console.error("Error uploading image:", uploadError);
          alert("Error uploading image: " + uploadError.message);
          return;
        }

        imageUrlToSave = publicUrl;

        if (post.image_url && post.image_url !== imageUrlToSave) {
          const { error: deleteError } = await deleteIssueImageByUrl(post.image_url);
          if (deleteError) {
            console.error("Error deleting old image:", deleteError);
          }
        }
      }

      const { error } = await supabase
        .from("stata_issues")
        .update({
          title: post.title,
          command: post.command,
          error_category: post.error_category,
          description: post.description,
          image_url: imageUrlToSave,
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

  const handleImageChange = (event) => {
    const file = event.target.files && event.target.files[0];
    setNewImageFile(file || null);
  };

  const deletePolipion = async (event) => {
    event.preventDefault();

    if (window.confirm('Are you sure you want to delete this STATA issue?')) {
      try {
        if (post.image_url) {
          const { error: deleteError } = await deleteIssueImageByUrl(post.image_url);
          if (deleteError) {
            console.error("Error deleting image:", deleteError);
          }
        }

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

  const removeImage = async () => {
    if (!post.image_url) return;

    if (!window.confirm("Remove the current image from this issue?")) {
      return;
    }

    try {
      const { error: deleteError } = await deleteIssueImageByUrl(post.image_url);
      if (deleteError) {
        console.error("Error deleting image:", deleteError);
        alert("Error deleting image: " + deleteError.message);
        return;
      }

      const { error: updateError } = await supabase
        .from("stata_issues")
        .update({ image_url: null })
        .eq("id", id);

      if (updateError) {
        console.error("Error clearing image:", updateError);
        alert("Error clearing image: " + updateError.message);
        return;
      }

      setPost((prev) => ({ ...prev, image_url: "" }));
      setNewImageFile(null);
    } catch (error) {
      console.error("Unexpected error:", error);
      alert("Unexpected error occurred: " + error.message);
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
            <label htmlFor="image_upload">Screenshot (optional)</label>
            <input
              type="file"
              id="image_upload"
              name="image_upload"
              accept="image/*"
              onChange={handleImageChange}
            />
            {resolveIssueImageUrl(post.image_url) && (
              <div style={{ marginTop: "10px" }}>
                <img
                  src={resolveIssueImageUrl(post.image_url)}
                  alt="Current STATA issue screenshot"
                  style={{
                    maxWidth: "100%",
                    borderRadius: "6px",
                    border: "1px solid var(--card-border)",
                  }}
                />
                <button
                  type="button"
                  className="remove-image-btn"
                  onClick={removeImage}
                >
                  Remove Image
                </button>
              </div>
            )}
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

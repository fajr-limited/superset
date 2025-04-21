import ReactDOM from 'react-dom';
import Button from 'src/components/Button';

// Modal component for selecting a PDF template
const PdfTemplateModal = ({ isOpen, onClose, onConfirm, onSendToNew, templates, selectedTemplate, setSelectedTemplate }) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="modal-content" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '400px', maxWidth: '90%' }}>
        <h2 style={{ marginBottom: '20px' }}>Select PDF Template</h2>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px' }}>Template:</label>
          <select
            value={selectedTemplate || ''}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d9d9d9', marginBottom: '16px' }}
          >
            <option value="" disabled>Select a template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <Button 
            buttonStyle="primary" 
            onClick={onSendToNew}
            style={{ width: '100%', marginBottom: '16px' }}
          >
            Send to New Template
          </Button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button buttonStyle="secondary" onClick={onConfirm} disabled={!selectedTemplate}>
            Send to Existing
          </Button>
          <Button buttonStyle="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PdfTemplateModal;
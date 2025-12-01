import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Reference } from '../../types';
import { DataTable } from '../../components/DataTable';

export const ReferencesConfig = () => {
  const { state, addReference, updateReference, deleteReference } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<Reference | null>(null);
  const [formData, setFormData] = useState({ name: '' });

  const handleAdd = () => {
    setEditingRef(null);
    setFormData({ name: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (reference: Reference) => {
    setEditingRef(reference);
    setFormData({ name: reference.name });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingRef) {
      updateReference(editingRef.id, { name: formData.name });
    } else {
      addReference({
        id: crypto.randomUUID(),
        name: formData.name,
      });
    }
    setIsModalOpen(false);
    setFormData({ name: '' });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this reference? This will also delete related data.')) {
      deleteReference(id);
    }
  };

  const columns = [
    {
      header: 'ID',
      accessor: (ref: Reference) => <span className="font-mono text-xs">{ref.id}</span>,
    },
    {
      header: 'Name',
      accessor: (ref: Reference) => ref.name,
    },
    {
      header: 'Actions',
      accessor: (ref: Reference) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(ref)}
            className="text-blue-600 hover:text-blue-800"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(ref.id)}
            className="text-red-600 hover:text-red-800"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Product References</h3>
      <DataTable
        columns={columns}
        data={state.references}
        onAdd={handleAdd}
        addButtonLabel="Add Reference"
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h4 className="text-lg font-semibold mb-4">
              {editingRef ? 'Edit Reference' : 'Add Reference'}
            </h4>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reference Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Ref02"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  {editingRef ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

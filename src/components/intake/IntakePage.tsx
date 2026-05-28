import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { IntakeForm, IntakeFormField } from '../../lib/database.types';
import { CheckCircle, Loader2, Calendar } from 'lucide-react';
import DatePicker from '../ui/DatePicker';

interface Props {
  slug: string;
}

export function IntakePage({ slug }: Props) {
  const [form, setForm] = useState<IntakeForm | null>(null);
  const [fields, setFields] = useState<IntakeFormField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadForm = useCallback(async () => {
    const { data: formData, error: formErr } = await supabase
      .from('intake_forms')
      .select('*')
      .eq('share_slug', slug)
      .maybeSingle();

    if (formErr || !formData) {
      setError('Form not found');
      setLoading(false);
      return;
    }

    if (!formData.is_public) {
      // Check if user is authenticated and a member
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('This form requires login to access.');
        setLoading(false);
        return;
      }
    }

    setForm(formData);

    const { data: fieldsData } = await supabase
      .from('intake_form_fields')
      .select('*')
      .eq('form_id', formData.id)
      .order('position');

    if (fieldsData) setFields(fieldsData);
    setLoading(false);
  }, [slug]);

  useEffect(() => { loadForm(); }, [loadForm]);

  // Filter fields based on conditionals
  const visibleFields = fields.filter(field => {
    if (!field.conditional_on) return true;
    const cond = field.conditional_on as { field_key: string; value: string };
    return values[cond.field_key] === cond.value;
  });

  function setValue(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    // Validate required fields
    const missing = visibleFields.filter(f => f.required && !values[f.field_key]?.trim());
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    setError(null);
    setSubmitting(true);

    const { error: submitErr } = await supabase.from('intake_submissions').insert({
      form_id: form.id,
      data: values,
      submitted_by_email: values['submitter_email'] ?? null,
    });

    setSubmitting(false);
    if (submitErr) { setError(submitErr.message); return; }
    setSubmitted(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-slate-800">Form not found</h1>
          <p className="text-slate-500 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Submitted!</h1>
          <p className="text-slate-500">Thank you for your submission. Your request has been received and will be reviewed by the team.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm font-medium text-slate-500">Content Request</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{form?.name}</h1>
          {form?.description && (
            <p className="text-slate-500 text-sm mb-6">{form.description}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {visibleFields.map(field => (
              <div key={field.id}>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <FieldInput
                  field={field}
                  value={values[field.field_key] ?? ''}
                  onChange={v => setValue(field.field_key, v)}
                />
              </div>
            ))}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 mt-4"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit request
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">Powered by ContentCal</p>
      </div>
    </div>
  );
}

function FieldInput({ field, value, onChange }: {
  field: IntakeFormField;
  value: string;
  onChange: (v: string) => void;
}) {
  const cls = "w-full px-3 py-2.5 text-sm text-slate-700 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-colors";

  if (field.field_type === 'long_text') {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={4}
        className={`${cls} resize-none`}
        placeholder={`Enter ${field.label.toLowerCase()}...`}
      />
    );
  }

  if (field.field_type === 'date') {
    return (
      <DatePicker
        value={value || null}
        onChange={(val) => onChange(val)}
        placeholder={`Select ${field.label.toLowerCase()}`}
      />
    );
  }

  if (field.field_type === 'single_select') {
    const options = (field.options as { value: string; label: string }[]) ?? [];
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={`${cls} bg-white`}>
        <option value="">Select...</option>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    );
  }

  return (
    <input
      type={field.field_type === 'url' ? 'url' : 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cls}
      placeholder={`Enter ${field.label.toLowerCase()}...`}
    />
  );
}

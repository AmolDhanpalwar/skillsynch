import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { User, Mail, Hash, Briefcase, Star, FolderOpen, Clock, UserCheck } from 'lucide-react';
import FormField from '../../components/form/FormField';
import type { Step1Values } from '../../types/form';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

interface Step1ProfileProps {
  form: UseFormReturn<Step1Values>;
}

export default function Step1Profile({ form }: Step1ProfileProps) {
  const { user } = useAuth();
  const [managerLoading, setManagerLoading] = useState(false);

  const {
    register,
    setValue,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (!user?.manager_id) return;
    setManagerLoading(true);
    supabase
      .from('users')
      .select('full_name, email')
      .eq('id', user.manager_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setValue('manager_name', data.full_name, { shouldDirty: false });
          setValue('manager_email', data.email, { shouldDirty: false });
        }
      })
      .finally(() => setManagerLoading(false));
  }, [user?.manager_id, setValue]);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="font-heading font-semibold text-base text-gray-800 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold">1</span>
          Employee Information
        </h2>
        <p className="text-xs text-gray-400 font-body pl-7">
          Verify your details and fill in any missing fields.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <FormField
          label="Employee Name"
          required
          placeholder="Your full name"
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        <FormField
          label="Employee Email"
          type="email"
          readOnly
          placeholder="your@email.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <FormField
          label="Employee Number"
          required
          placeholder="e.g. EMP001"
          error={errors.employee_number?.message}
          {...register('employee_number')}
        />
        <FormField
          label="Designation"
          required
          placeholder="e.g. Software Engineer"
          error={errors.designation?.message}
          {...register('designation')}
        />

        <FormField
          label="Grade"
          required
          placeholder="e.g. L2"
          error={errors.grade?.message}
          {...register('grade')}
        />
        <FormField
          label="Current Project Name"
          required
          placeholder="Project name or account"
          error={errors.current_project?.message}
          {...register('current_project')}
        />

        <FormField
          label="Total Years of Experience"
          type="number"
          required
          min={0}
          max={50}
          step={0.5}
          placeholder="e.g. 5"
          hint="Total professional experience in years"
          error={errors.total_exp?.message}
          {...register('total_exp')}
        />
        <FormField
          label="Relevant Years of Experience"
          type="number"
          required
          min={0}
          max={50}
          step={0.5}
          placeholder="e.g. 3"
          hint="Experience relevant to current role"
          error={errors.relevant_exp?.message}
          {...register('relevant_exp')}
        />

        <FormField
          label="Haptiq Experience (Years)"
          type="number"
          required
          min={0}
          max={50}
          step={0.5}
          placeholder="e.g. 1.5"
          hint="Years worked at Haptiq"
          error={errors.haptiq_exp?.message}
          {...register('haptiq_exp')}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold font-heading text-gray-600 uppercase tracking-wide">
            Manager Name
          </label>
          <div className="relative">
            <input
              type="text"
              readOnly
              placeholder={managerLoading ? 'Loading…' : user?.manager_id ? '' : 'No manager assigned'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-body text-gray-500 cursor-default outline-none"
              {...register('manager_name')}
            />
            {managerLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-gray-300 border-t-accent-500 rounded-full animate-spin" />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <FormField
          label="Manager Email"
          type="email"
          readOnly
          placeholder={managerLoading ? 'Loading…' : user?.manager_id ? '' : 'No manager assigned'}
          {...register('manager_email')}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 pt-2">
        {[
          { icon: User, label: 'Personal Info', done: true },
          { icon: Clock, label: 'Experience', done: true },
          { icon: UserCheck, label: 'Manager', done: !!user?.manager_id },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-body border
              ${item.done
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-gray-50 border-gray-100 text-gray-400'
              }`}
          >
            <item.icon size={13} className="shrink-0" />
            <span className="font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

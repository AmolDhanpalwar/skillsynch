interface LogoProps {
  showSubtitle?: boolean;
}

export default function Logo({ showSubtitle = true }: LogoProps) {
  return (
    <div className="flex flex-col items-start">
      <span className="font-heading font-bold text-xl text-white tracking-wide leading-none">
        HAPTIQ
        <span
          className="block h-0.5 mt-0.5 rounded-full"
          style={{ backgroundColor: '#00A9CE', width: '100%' }}
        />
      </span>
      {showSubtitle && (
        <span className="font-heading font-semibold text-xs text-accent-300 tracking-widest uppercase mt-1">
          SkillSync
        </span>
      )}
    </div>
  );
}


export const EmptyMedications = () => {
  return (
    <div className="text-center py-12 bg-card rounded-lg">
      <img
        src="/lovable-uploads/e747fbbf-5ff6-4891-90c6-c43b8b464dff.png"
        alt="Empty state"
        className="w-32 h-32 mx-auto mb-4 rounded-full"
      />
      <p className="text-muted-foreground">No medications added yet.</p>
      <p className="text-sm text-muted-foreground mt-1">
        Click the "Add Medication" button to get started.
      </p>
    </div>
  );
};


import { useState, useEffect } from "react";

type StrengthLevel = "weak" | "medium" | "strong" | "very-strong";

interface PasswordStrengthIndicatorProps {
  password: string;
}

export const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const [strength, setStrength] = useState<StrengthLevel>("weak");
  const [score, setScore] = useState(0);

  useEffect(() => {
    // Calculate password strength
    const calculateStrength = () => {
      if (!password) {
        setStrength("weak");
        setScore(0);
        return;
      }

      let newScore = 0;

      // Length check
      if (password.length > 8) newScore += 1;
      if (password.length > 12) newScore += 1;

      // Complexity checks
      if (/[A-Z]/.test(password)) newScore += 1;
      if (/[a-z]/.test(password)) newScore += 1;
      if (/[0-9]/.test(password)) newScore += 1;
      if (/[^A-Za-z0-9]/.test(password)) newScore += 1;

      // Set strength based on score
      if (newScore <= 2) {
        setStrength("weak");
      } else if (newScore <= 4) {
        setStrength("medium");
      } else if (newScore <= 5) {
        setStrength("strong");
      } else {
        setStrength("very-strong");
      }

      setScore(newScore);
    };

    calculateStrength();
  }, [password]);

  const getColorByStrength = () => {
    switch (strength) {
      case "weak":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      case "strong":
        return "bg-green-500";
      case "very-strong":
        return "bg-emerald-500";
      default:
        return "bg-gray-200";
    }
  };

  const getWidthByScore = () => {
    return `${Math.min(100, (score / 6) * 100)}%`;
  };

  return (
    <div className="mt-2">
      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColorByStrength()} transition-all duration-300 ease-in-out`}
          style={{ width: getWidthByScore() }}
        />
      </div>
      <p className="text-xs mt-1 text-gray-500">
        {strength === "weak" && "Weak - Add numbers, symbols & uppercase letters"}
        {strength === "medium" && "Medium - Make your password longer"}
        {strength === "strong" && "Strong - Good password!"}
        {strength === "very-strong" && "Very strong - Excellent password!"}
      </p>
    </div>
  );
};

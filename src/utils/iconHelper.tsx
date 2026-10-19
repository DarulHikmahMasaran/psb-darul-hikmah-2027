import React from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle,
  HelpCircle,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  Award,
  Users,
  Clock,
  ChevronDown,
  Sparkles,
  School,
  FileCheck,
  UserCheck,
  Globe,
  Instagram,
  FileText,
  Send,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Activity,
  Layers
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  BookOpen,
  Calendar,
  CheckCircle,
  HelpCircle,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  Award,
  Users,
  Clock,
  ChevronDown,
  Sparkles,
  School,
  FileCheck,
  UserCheck,
  Globe,
  Instagram,
  FileText,
  Send,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Activity,
  Layers,
};

export const DynamicIcon: React.FC<{
  name?: string;
  className?: string;
  defaultIcon?: React.ElementType;
}> = ({ name, className = 'w-5 h-5', defaultIcon: DefaultIcon = CheckCircle }) => {
  if (!name) return <DefaultIcon className={className} />;
  const Component = iconMap[name] || DefaultIcon;
  return <Component className={className} />;
};

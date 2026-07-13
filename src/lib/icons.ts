/**
 * Single import point for icons used across the app (feature layer).
 *
 * Why this file exists: every route/component imports its icons from here
 * (`@/lib/icons`) instead of directly from "lucide-react". To swap the icon
 * set in the future (or rename/replace an icon app-wide), change the mapping
 * here only — feature code stays untouched.
 *
 * NOTE: the vendored shadcn primitives under `src/components/ui/*` import
 * lucide directly on purpose (they are third-party-style building blocks and
 * tightly coupled to their own icon choices). The feature layer goes through
 * this barrel. See THEME.md.
 */
export {
  // Navigation / layout
  Home,
  Camera,
  Settings,
  History,
  BookImage,
  ArrowUpRight,
  ArrowLeft,
  // Features
  Shirt,
  ScanLine,
  Sparkles,
  Search,
  Upload,
  ImagePlus,
  // Actions
  Check,
  Copy,
  Download,
  Share2,
  Save,
  RotateCw,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  // Status / feedback
  AlertTriangle,
  Bell,
  Heart,
  Palette,
  Shield,
  FileText,
  // People / account
  Users,
  UserPlus,
  LogOut,
  CreditCard,
  // Store profile
  MapPin,
  Phone,
  Mail,
  Instagram,
  MessageCircle,
  Globe,
  Building2,
  Calendar,
} from "lucide-react";

export type { LucideIcon } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   ArchBrief v5 — vendors.js
   Single source of truth for all vendor configuration.
   Every other module imports from here.
═══════════════════════════════════════════════════════════ */

const VENDORS = {
  aws: {
    key:       'aws',
    label:     'AWS',
    fullName:  'Amazon Web Services',
    color:     '#ff9900',
    cssVar:    '--aws',
    icon:      '☁',
    irapStatus:'assessed',
    irapLevel: 'PROTECTED',
  },
  ibm: {
    key:       'ibm',
    label:     'IBM',
    fullName:  'IBM Cloud',
    color:     '#4589ff',
    cssVar:    '--ibm',
    icon:      '🔵',
    irapStatus:'assessed',
    irapLevel: 'OFFICIAL',
  },
  azure: {
    key:       'azure',
    label:     'Azure',
    fullName:  'Microsoft Azure',
    color:     '#0078d4',
    cssVar:    '--azure',
    icon:      '⬡',
    irapStatus:'assessed',
    irapLevel: 'PROTECTED',
  },
  oracle: {
    key:       'oracle',
    label:     'Oracle',
    fullName:  'Oracle Cloud Infrastructure',
    color:     '#f80000',
    cssVar:    '--oracle',
    icon:      '⬤',
    irapStatus:'in-progress',
    irapLevel: 'OFFICIAL',
  },
  salesforce: {
    key:       'salesforce',
    label:     'Salesforce',
    fullName:  'Salesforce Government Cloud',
    color:     '#00a1e0',
    cssVar:    '--salesforce',
    icon:      '☁',
    irapStatus:'assessed',
    irapLevel: 'OFFICIAL',
  },
  servicenow: {
    key:       'servicenow',
    label:     'ServiceNow',
    fullName:  'ServiceNow',
    color:     '#62d84e',
    cssVar:    '--servicenow',
    icon:      '⚙',
    irapStatus:'in-progress',
    irapLevel: 'OFFICIAL',
  },
  paloalto: {
    key:       'paloalto',
    label:     'Palo Alto',
    fullName:  'Palo Alto Networks',
    color:     '#ef5925',
    cssVar:    '--paloalto',
    icon:      '🔥',
    irapStatus:'not-assessed',
    irapLevel: 'unknown',
  },
  hashicorp: {
    key:       'hashicorp',
    label:     'HashiCorp',
    fullName:  'HashiCorp / Terraform',
    color:     '#7b42bc',
    cssVar:    '--hashicorp',
    icon:      '◈',
    irapStatus:'not-assessed',
    irapLevel: 'unknown',
  },
  emerging: {
    key:       'emerging',
    label:     'Emerging',
    fullName:  'Emerging & Startups',
    color:     '#ffd700',
    cssVar:    '--emerging',
    icon:      '⭐',
    irapStatus:'not-assessed',
    irapLevel: 'unknown',
  },
};

// Ordered array for consistent display
const VENDOR_KEYS = ['aws','ibm','azure','oracle','salesforce','servicenow','paloalto','hashicorp','emerging'];
const VENDOR_LIST = VENDOR_KEYS.map(k => VENDORS[k]);

// Helper: get vendor colour
function vendorColor(key) {
  return VENDORS[key]?.color || 'var(--g)';
}

// Helper: get vendor label
function vendorLabel(key) {
  return VENDORS[key]?.label || key;
}

// Helper: build vendor tag HTML
function vendorTag(key) {
  const v = VENDORS[key];
  if (!v) return '';
  return `<span class="tag tag-vendor" style="--vendor-color:${v.color}">${v.label}</span>`;
}

// Helper: build multiple vendor tags
function vendorTags(keys = []) {
  return keys.map(vendorTag).join('');
}

// Certification paths that map to vendor modules
const CERTIFICATIONS = {
  'aws-saa': {
    name:    'AWS Solutions Architect Associate',
    vendor:  'aws',
    color:   '#ff9900',
    modules: ['cf-01','cf-02','cf-06','cf-07','cf-08','cf-09','sec-01','sec-03','plat-02'],
  },
  'azure-architect': {
    name:    'Azure Solutions Architect Expert',
    vendor:  'azure',
    color:   '#0078d4',
    modules: ['cf-01','cf-03','cf-06','cf-07','cf-08','cf-09','sec-01','sec-02','sec-04','ai-02'],
  },
  'ibm-cloud-pro': {
    name:    'IBM Certified Architect — Cloud',
    vendor:  'ibm',
    color:   '#4589ff',
    modules: ['cf-01','cf-04','cf-06','cf-07','cf-08','ai-01','plat-02','plat-03'],
  },
  'aps-architect': {
    name:    'APS Digital Architecture Specialist',
    vendor:  null,
    color:   '#00843d',
    modules: ['aps-01','aps-02','aps-03','aps-04','aps-05','aps-06','cf-09','sec-01'],
  },
  'terraform-assoc': {
    name:    'HashiCorp Terraform Associate',
    vendor:  'hashicorp',
    color:   '#7b42bc',
    modules: ['plat-01','plat-02','plat-03','cf-09'],
  },
};

// Export for module use (when used as ES module) or assign to window
if (typeof module !== 'undefined') {
  module.exports = { VENDORS, VENDOR_KEYS, VENDOR_LIST, vendorColor, vendorLabel, vendorTag, vendorTags, CERTIFICATIONS };
} else {
  window.VENDORS       = VENDORS;
  window.VENDOR_KEYS   = VENDOR_KEYS;
  window.VENDOR_LIST   = VENDOR_LIST;
  window.vendorColor   = vendorColor;
  window.vendorLabel   = vendorLabel;
  window.vendorTag     = vendorTag;
  window.vendorTags    = vendorTags;
  window.CERTIFICATIONS = CERTIFICATIONS;
}

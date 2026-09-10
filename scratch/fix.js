const fs = require('fs');
const glob = require('glob');

function replaceInFile(file, regex, replacement) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content);
}

// 1. Remove UserRole from tests
const testFiles = glob.sync('src/__tests__/**/*.ts');
testFiles.forEach(file => {
  replaceInFile(file, /import \{[^}]*UserRole[^}]*\} from ['"]@prisma\/client['"];?/g, 'import { VerificationMethod, RequestStatus, RewardStatus } from "@prisma/client";');
  replaceInFile(file, /role:\s*UserRole\.\w+,?/g, '');
  replaceInFile(file, /user\.role === [^\n]+/g, '');
  replaceInFile(file, /expect\(.*\.role\).*;/g, '');
  replaceInFile(file, /import \{[^}]*UserRoleSchema[^}]*\} from ['"]\.\.\/lib\/validations['"];?/g, '');
});

// 2. Fix verificationRequest -> visitRequest in analytics API
replaceInFile('src/app/api/business/analytics/route.ts', /prisma\.verificationRequest/g, 'prisma.visitRequest');
replaceInFile('src/app/api/business/analytics/route.ts', /m:\s*any/g, 'm: any');

// 3. Fix API routes where I failed to replace user.role
const apiFiles = [
  'src/app/api/business/route.ts',
  'src/app/api/business/setup/route.ts'
];
apiFiles.forEach(file => {
  replaceInFile(file, /if \(!user \|\| user\.role !== UserRole\.BUSINESS_OWNER\) \{/g, 'if (!user) {');
  replaceInFile(file, /import \{[^}]*UserRole[^}]*\} from ['"]@prisma\/client['"];?/g, '');
});

// 4. Fix pages where I failed to replace UserRole
const pageFiles = [
  'src/app/business/page.tsx',
  'src/app/business/qr/page.tsx',
  'src/app/business/settings/page.tsx',
  'src/app/business/setup/page.tsx',
  'src/app/page.tsx'
];
pageFiles.forEach(file => {
  replaceInFile(file, /import \{[^}]*UserRole[^}]*\} from ['"]@prisma\/client['"];?/g, '');
  replaceInFile(file, /if \(!user \|\| user\.role !== UserRole\.BUSINESS_OWNER\) \{/g, 'if (!user) {');
});

// 5. Fix claim route
replaceInFile('src/app/api/customer/reward/claim/route.ts', /\.\/otp\/route/g, '../otp/route');

import { loadSchema } from '@zenstackhq/testtools';
import fs from 'fs';
import path from 'path';
import tmp from 'tmp';

describe('Prisma plugin tests', () => {
    let origDir: string;

    beforeEach(() => {
        origDir = process.cwd();
    });

    afterEach(() => {
        process.chdir(origDir);
    });

    it('standard output location', async () => {
        const model = `
model User {
    id String @id @default(cuid())
}
        `;
        const { projectDir } = await loadSchema(model);
        expect(fs.existsSync(path.join(projectDir, './prisma/schema.prisma'))).toEqual(true);
    });

    it('relative output location', async () => {
        const model = `
model User {
    id String @id @default(cuid())
}

plugin prisma {
    provider = '@core/prisma'
    output = './db/schema.prisma'
}
        `;
        const { projectDir } = await loadSchema(model, true, false);
        expect(fs.existsSync(path.join(projectDir, './db/schema.prisma'))).toEqual(true);
    });

    it('relative absolute location', async () => {
        const { name: outDir } = tmp.dirSync({ unsafeCleanup: true });
        const model = `
model User {
    id String @id @default(cuid())
}

plugin prisma {
    provider = '@core/prisma'
    output = '${outDir}/db/schema.prisma'
}
        `;
        await loadSchema(model, true, false);
        expect(fs.existsSync(path.join(outDir, './db/schema.prisma'))).toEqual(true);
    });
});

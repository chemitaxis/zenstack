/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="@types/jest" />

import { loadSchema } from '@zenstackhq/testtools';
import bodyParser from 'body-parser';
import express from 'express';
import superjson from 'superjson';
import request from 'supertest';
import RESTAPIHandler from '../../src/api/rest';
import { ZenStackMiddleware } from '../../src/express';
import { makeUrl, schema } from '../utils';

describe('Express adapter tests - rpc handler', () => {
    it('run plugin regular json', async () => {
        const { prisma, zodSchemas } = await loadSchema(schema);

        const app = express();
        app.use(bodyParser.json());
        app.use('/api', ZenStackMiddleware({ getPrisma: () => prisma, zodSchemas }));

        let r = await request(app).get(makeUrl('/api/post/findMany', { where: { id: { equals: '1' } } }));
        expect(r.status).toBe(200);
        expect(r.body).toHaveLength(0);

        r = await request(app)
            .post('/api/user/create')
            .send({
                include: { posts: true },
                data: {
                    id: 'user1',
                    email: 'user1@abc.com',
                    posts: {
                        create: [
                            { title: 'post1', published: true, viewCount: 1 },
                            { title: 'post2', published: false, viewCount: 2 },
                        ],
                    },
                },
            });

        expect(r.status).toBe(201);
        expect(r.body).toEqual(
            expect.objectContaining({
                email: 'user1@abc.com',
                posts: expect.arrayContaining([
                    expect.objectContaining({ title: 'post1' }),
                    expect.objectContaining({ title: 'post2' }),
                ]),
            })
        );
        // aux fields should have been removed
        const data = r.body;
        expect(data.zenstack_guard).toBeUndefined();
        expect(data.zenstack_transaction).toBeUndefined();
        expect(data.posts[0].zenstack_guard).toBeUndefined();
        expect(data.posts[0].zenstack_transaction).toBeUndefined();

        r = await request(app).get(makeUrl('/api/post/findMany'));
        expect(r.status).toBe(200);
        expect(r.body).toHaveLength(2);

        r = await request(app).get(makeUrl('/api/post/findMany', { where: { viewCount: { gt: 1 } } }));
        expect(r.status).toBe(200);
        expect(r.body).toHaveLength(1);

        r = await request(app)
            .put('/api/user/update')
            .send({ where: { id: 'user1' }, data: { email: 'user1@def.com' } });
        expect(r.status).toBe(200);
        expect(r.body.email).toBe('user1@def.com');

        r = await request(app).get(makeUrl('/api/post/count', { where: { viewCount: { gt: 1 } } }));
        expect(r.status).toBe(200);
        expect(r.body).toBe(1);

        r = await request(app).get(makeUrl('/api/post/aggregate', { _sum: { viewCount: true } }));
        expect(r.status).toBe(200);
        expect(r.body._sum.viewCount).toBe(3);

        r = await request(app).get(makeUrl('/api/post/groupBy', { by: ['published'], _sum: { viewCount: true } }));
        expect(r.status).toBe(200);
        expect(r.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ published: true, _sum: { viewCount: 1 } }),
                expect.objectContaining({ published: false, _sum: { viewCount: 2 } }),
            ])
        );

        r = await request(app).delete(makeUrl('/api/user/deleteMany', { where: { id: 'user1' } }));
        expect(r.status).toBe(200);
        expect(r.body.count).toBe(1);
    });

    it('invalid path or args', async () => {
        const { prisma, zodSchemas } = await loadSchema(schema);

        const app = express();
        app.use(bodyParser.json());
        app.use('/api', ZenStackMiddleware({ getPrisma: () => prisma, zodSchemas }));

        let r = await request(app).get('/api/post/');
        expect(r.status).toBe(400);

        r = await request(app).get('/api/post/findMany/abc');
        expect(r.status).toBe(400);

        r = await request(app).get('/api/post/findMany?q=abc');
        expect(r.status).toBe(400);
    });

    it('run plugin superjson', async () => {
        const { prisma, zodSchemas } = await loadSchema(schema);

        const app = express();
        app.use(bodyParser.json());
        app.use('/api', ZenStackMiddleware({ getPrisma: () => prisma, zodSchemas, useSuperJson: true }));

        let r = await request(app).get(makeUrl('/api/post/findMany', { where: { id: { equals: '1' } } }, true));
        expect(r.status).toBe(200);
        expect(unmarshal(r.body)).toHaveLength(0);

        r = await request(app)
            .post('/api/user/create')
            .send({
                include: { posts: true },
                data: {
                    id: 'user1',
                    email: 'user1@abc.com',
                    posts: {
                        create: [
                            { title: 'post1', published: true, viewCount: 1 },
                            { title: 'post2', published: false, viewCount: 2 },
                        ],
                    },
                },
            });

        expect(r.status).toBe(201);
        expect(unmarshal(r.body)).toEqual(
            expect.objectContaining({
                email: 'user1@abc.com',
                posts: expect.arrayContaining([
                    expect.objectContaining({ title: 'post1' }),
                    expect.objectContaining({ title: 'post2' }),
                ]),
            })
        );
        // aux fields should have been removed
        const data = unmarshal(r.body);
        expect(data.zenstack_guard).toBeUndefined();
        expect(data.zenstack_transaction).toBeUndefined();
        expect(data.posts[0].zenstack_guard).toBeUndefined();
        expect(data.posts[0].zenstack_transaction).toBeUndefined();

        r = await request(app).get(makeUrl('/api/post/findMany'));
        expect(r.status).toBe(200);
        expect(unmarshal(r.body)).toHaveLength(2);

        r = await request(app).get(makeUrl('/api/post/findMany', { where: { viewCount: { gt: 1 } } }, true));
        expect(r.status).toBe(200);
        expect(unmarshal(r.body)).toHaveLength(1);

        r = await request(app)
            .put('/api/user/update')
            .send({ where: { id: 'user1' }, data: { email: 'user1@def.com' } });
        expect(r.status).toBe(200);
        expect(unmarshal(r.body).email).toBe('user1@def.com');

        r = await request(app).get(makeUrl('/api/post/count', { where: { viewCount: { gt: 1 } } }, true));
        expect(r.status).toBe(200);
        expect(unmarshal(r.body)).toBe(1);

        r = await request(app).get(makeUrl('/api/post/aggregate', { _sum: { viewCount: true } }, true));
        expect(r.status).toBe(200);
        expect(unmarshal(r.body)._sum.viewCount).toBe(3);

        r = await request(app).get(
            makeUrl('/api/post/groupBy', { by: ['published'], _sum: { viewCount: true } }, true)
        );
        expect(r.status).toBe(200);
        expect(unmarshal(r.body)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ published: true, _sum: { viewCount: 1 } }),
                expect.objectContaining({ published: false, _sum: { viewCount: 2 } }),
            ])
        );

        r = await request(app).delete(makeUrl('/api/user/deleteMany', { where: { id: 'user1' } }, true));
        expect(r.status).toBe(200);
        expect(unmarshal(r.body).count).toBe(1);
    });
});

function unmarshal(value: any) {
    return superjson.parse(JSON.stringify(value)) as any;
}

describe('Express adapter tests - rest handler', () => {
    it('run middleware', async () => {
        const { prisma, zodSchemas, modelMeta } = await loadSchema(schema);

        const app = express();
        app.use(bodyParser.json());
        app.use(
            '/api',
            ZenStackMiddleware({
                getPrisma: () => prisma,
                modelMeta,
                zodSchemas,
                handler: RESTAPIHandler({ endpoint: 'http://localhost/api' }),
            })
        );

        let r = await request(app).get(makeUrl('/api/post/1'));
        expect(r.status).toBe(404);

        r = await request(app)
            .post('/api/user')
            .send({
                data: {
                    type: 'user',
                    attributes: {
                        id: 'user1',
                        email: 'user1@abc.com',
                    },
                },
            });
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({
            jsonapi: { version: '1.1' },
            data: { type: 'user', id: 'user1', attributes: { email: 'user1@abc.com' } },
        });

        r = await request(app).get('/api/user?filter[id]=user1');
        expect(r.body.data).toHaveLength(1);

        r = await request(app).get('/api/user?filter[id]=user2');
        expect(r.body.data).toHaveLength(0);

        r = await request(app).get('/api/user?filter[id]=user1&filter[email]=xyz');
        expect(r.body.data).toHaveLength(0);

        r = await request(app)
            .put('/api/user/user1')
            .send({ data: { type: 'user', attributes: { email: 'user1@def.com' } } });
        expect(r.status).toBe(200);
        expect(r.body.data.attributes.email).toBe('user1@def.com');

        r = await request(app).delete(makeUrl('/api/user/user1'));
        expect(r.status).toBe(204);
        expect(await prisma.user.findMany()).toHaveLength(0);
    });
});

describe('Express adapter tests - rest handler with customMiddleware', () => {
    it('run middleware', async () => {
        const { prisma, zodSchemas, modelMeta } = await loadSchema(schema);

        const app = express();
        app.use(bodyParser.json());
        app.use(
            '/api',
            ZenStackMiddleware({
                getPrisma: () => prisma,
                modelMeta,
                zodSchemas,
                handler: RESTAPIHandler({ endpoint: 'http://localhost/api' }),
                manageCustomResponse: true,
            })
        );

        app.use((req, res) => {
            res.status(res.locals.status).json({ message: res.locals.body });
        });

        const r = await request(app).get(makeUrl('/api/post/1'));
        expect(r.status).toBe(404);
        expect(r.body).toHaveProperty('errors');
    });
});

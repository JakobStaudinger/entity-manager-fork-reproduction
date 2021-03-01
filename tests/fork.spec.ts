import { Entity, EntityManager, IdentifiedReference, ManyToOne, MikroORM, PrimaryKey, Property, Reference } from '@mikro-orm/core';
import { AsyncLocalStorage } from 'async_hooks';
import { ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

@Entity()
class Author {
  @PrimaryKey()
  public readonly _id = new ObjectId();

  @Property()
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }
}

@Entity()
class Book {
  @PrimaryKey()
  public readonly _id = new ObjectId();

  @ManyToOne(() => Author, { eager: true, wrappedReference: true })
  public readonly author: IdentifiedReference<Author>;

  constructor(author: IdentifiedReference<Author>) {
    this.author = author;
  }
}

describe('Forking EntityManager', () => {
  const databaseInstance = new MongoMemoryServer({
    instance: { dbName: 'Test', storageEngine: 'ephemeralForTest' },
  });

  let orm: MikroORM;
  let databaseUri: string;

  const storage = new AsyncLocalStorage<EntityManager>();

  beforeAll(async () => {
    await databaseInstance.ensureInstance();
    databaseUri = await databaseInstance.getUri();

    orm = await MikroORM.init({
      type: 'mongo',
      clientUrl: databaseUri,
      dbName: 'Test',
      entities: [Author, Book],
      context: () => storage.getStore(),
    });

    const author = new Author('William Shakespeare');
    const book = new Book(Reference.create(author));
    const em = orm.em;
    em.persist(author);
    em.persist(book);

    await em.flush();
    em.clear();
  });

  afterAll(async () => {
    await orm.close();
    await databaseInstance.stop();
  });

  it('should keep the correct IdentityMap', async () => {
    const em = orm.em.fork(true, true);
    await runInNewContext(em, async () => {
      const author = await em.findOneOrFail(Author, { name: 'William Shakespeare' });

      const forkedEM = em.fork(false, true);
      await runInNewContext(forkedEM, async () => {
        const book = await forkedEM.findOneOrFail(Book, { author });
        expect(book.author.unwrap()).toBe(author);
      });
    });
  });

  function runInNewContext(entityManager: EntityManager, fn: () => Promise<void>) {
    return new Promise((resolve, reject) => {
      storage.run(entityManager, () => {
        fn().then(resolve).catch(reject);
      });
    });
  }
});

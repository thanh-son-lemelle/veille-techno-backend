import { DataSource } from 'typeorm';
import { User } from './user.entity';

class MetadataDataSource extends DataSource {
  async loadMetadata() {
    await this.buildMetadatas();
  }
}
// Tests for the User entity's query behavior
describe('User queries', () => {
  let dataSource: MetadataDataSource;
// lifecycle hooks for setting up and tearing down the test environment
  beforeAll(async () => {
    dataSource = new MetadataDataSource({
      type: 'postgres',
      entities: [User],
    });
    await dataSource.loadMetadata();
  });
// test cases for the User entity's query behavior
  it('omits the password hash from ordinary user reads', () => {
    const query = dataSource.getRepository(User).createQueryBuilder('user');

    expect(query.getSql()).toContain('"user"."email"');
    expect(query.getSql()).not.toContain('"user"."password"');
  });
// test cases for authentication-related queries
  it('allows authentication to explicitly select the password hash', () => {
    const query = dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.password');

    expect(query.getSql()).toContain('"user"."password"');
  });
});

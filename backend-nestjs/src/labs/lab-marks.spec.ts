import { NotFoundException } from '@nestjs/common';
import { LabsService } from './labs.service';

function setup() {
  const empty = {} as never;
  const experiments = {
    findOne: jest.fn().mockResolvedValue({ id: 'experiment', lab_id: 'lab' }),
  };
  const links = {
    findOne: jest
      .fn()
      .mockResolvedValue({
        id: 'practice',
        lab_experiment_id: 'experiment',
        maxScore: 10,
      }),
    save: jest.fn().mockImplementation((value) => value),
  };
  const manager = {
    getRepository: jest.fn().mockReturnValue(links),
    query: jest.fn(),
  };
  const transaction = jest
    .fn()
    .mockImplementation((callback) => callback(manager));
  const service = new LabsService(
    empty,
    empty,
    empty,
    empty,
    empty,
    empty,
    experiments as never,
    { manager: { transaction } } as never,
    empty,
    empty,
    empty,
    empty,
    empty,
    empty,
    empty,
    empty,
    empty,
  );
  return { service, experiments, links, manager, transaction };
}

describe('Practice marks', () => {
  it('resolves the owning experiment before locking a practice row without an outer join', async () => {
    const { service, links, manager } = setup();
    await expect(
      service.setPracticeMarks('lab', 'experiment', 'practice', 20),
    ).resolves.toMatchObject({ maxScore: 20 });
    const query = links.findOne.mock.calls[0][0];
    expect(query).toMatchObject({
      where: { id: 'practice', lab_experiment_id: 'experiment' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(query).not.toHaveProperty('relations');
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE lab_problem_progress'),
      ['practice', 10, 20],
    );
  });

  it('rejects a mismatched experiment without touching scores', async () => {
    const { service, experiments, transaction } = setup();
    experiments.findOne.mockResolvedValue(null);
    await expect(
      service.setPracticeMarks('other-lab', 'experiment', 'practice', 20),
    ).rejects.toThrow(NotFoundException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not change scores when the question is no longer attached', async () => {
    const { service, links, manager } = setup();
    links.findOne.mockResolvedValue(null);
    await expect(
      service.setPracticeMarks('lab', 'experiment', 'practice', 20),
    ).rejects.toThrow(NotFoundException);
    expect(manager.query).not.toHaveBeenCalled();
  });
});

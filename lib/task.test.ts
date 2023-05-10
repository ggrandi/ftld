import { Option } from "./option";
import { Result } from "./result";
import { Task, TaskTimeoutError, TaskSchedulingError } from "./task";

// Monad Laws
// 1. Left Identity: M.from(a).flatMap(f) == f(a)
// 2. Right Identity: m.flatMap(M.from) == m
// 3. Associativity: m.flatMap(f).flatMap(g) == m.flatMap((x) => f(x).flatMap(g))

describe.concurrent("Task", () => {
  // Helper function to compare Task results
  const compareTaskResults = async (
    task1: Task<any, any>,
    task2: Task<any, any>
  ) => {
    const res1 = await task1.run();
    const res2 = await task2.run();

    expect(res1).toEqual(res2);
  };

  it("should satisfy the Left Identity law", async () => {
    const a = 42;
    const f = (x: number) => Task.from(x * 2);

    const task1 = Task.from(a).flatMap(f);
    const task2 = f(a);

    await compareTaskResults(task1, task2);
  });

  it("should satisfy the Right Identity law", async () => {
    const a = 42;
    const m = Task.from(a);

    const task1 = m.flatMap(Task.from);
    const task2 = m;

    await compareTaskResults(task1, task2);
  });

  it("should satisfy the Associativity law", async () => {
    const a = 42;
    const m = Task.from(a);
    const f = (x: number) => Task.from(x * 2);
    const g = (x: number) => Task.from(x + 1);

    const task1 = m.flatMap(f).flatMap(g);
    const task2 = m.flatMap((b) => f(b).flatMap(g));

    await compareTaskResults(task1, task2);
  });

  describe.concurrent("from", () => {
    it("should correctly construct from a value", async () => {
      const value = 42;
      const task = Task.from(value);
      const result = await task.run();
      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(value);
    });

    it("should correctly construct from a promise", async () => {
      const value = 42;
      const task = Task.from(() => Promise.resolve(value));
      const result = await task.run();
      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(value);
    });

    it("should correctly construct from a result", async () => {
      const value = 42;
      const result = Result.Ok(value);
      const task = Task.from(result);
      const taskResult = await task.run();
      expect(taskResult.isOk()).toBeTruthy();
      expect(taskResult.unwrap()).toEqual(value);
    });

    it("should correctly construct from an option", async () => {
      const value = 42;
      const error = new Error("An error occurred");
      const option = Option.Some(value);
      const task = Task.from(option, () => error);
      const result = await task.run();
      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(value);
    });

    it("should correctly infer return type from all possible values", async () => {
      const value = [1, 2, 3];
      const option = Option.Some(value);
      const result = Result.from(value, () => new Error("An error occurred"));
      const promise = () => Promise.resolve(value);
      const task = Task.from(value, () => new Error("An error occurred"));
      const promiseResult = () => Promise.resolve(result);
      const fetchPromise = () =>
        fetch("https://google.com").then(() => value as number[]);
      const promiseObj = () => Promise.resolve({ value });
      const fetchPromiseObj = () =>
        fetch("https://google.com").then(
          (res) => res.json() as Promise<{ value: number[] }>
        );

      const never = () => {
        throw new Error("This should never be called");
      };

      expectTypeOf(Task.from(never)).toEqualTypeOf<Task<unknown, never>>();
      expectTypeOf(Task.from(option)).toEqualTypeOf<Task<unknown, number[]>>();
      expectTypeOf(Task.from(result)).toEqualTypeOf<Task<Error, number[]>>();
      expectTypeOf(Task.from(promise)).toEqualTypeOf<Task<unknown, number[]>>();
      expectTypeOf(Task.from(fetchPromise)).toEqualTypeOf<
        Task<unknown, number[]>
      >();
      expectTypeOf(Task.from(task)).toEqualTypeOf<Task<Error, number[]>>();
      expectTypeOf(Task.from(promiseResult)).toEqualTypeOf<
        Task<Error, number[]>
      >();
      expectTypeOf(Task.from(value)).toEqualTypeOf<Task<unknown, number[]>>();
      expectTypeOf(Task.from(promiseObj)).toEqualTypeOf<
        Task<unknown, { value: number[] }>
      >();
      expectTypeOf(Task.from(fetchPromiseObj)).toEqualTypeOf<
        Task<unknown, { value: number[] }>
      >();
    });
  });

  describe.concurrent("fromPredicate", () => {
    it("should correctly construct from a value", async () => {
      const value = 42;
      const task = Task.fromPredicate(
        () => value,
        () => true,
        () => new Error("An error occurred")
      );
      const result = await task.run();
      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(value);
    });

    it("should correctly construct from a promise", async () => {
      const value = 42;
      const task = Task.fromPredicate(
        () => Promise.resolve(value),
        () => true,
        () => new Error("An error occurred")
      );
      const result = await task.run();
      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(value);
    });

    it("should correctly construct from a result", async () => {
      const value = 42;
      const result = Result.Ok(value);
      const task = Task.fromPredicate(
        () => result,
        () => true,
        () => new Error("An error occurred")
      );
      const taskResult = await task.run();
      expect(taskResult.isOk()).toBeTruthy();
      expect(taskResult.unwrap()).toEqual(value);
    });

    it("should correctly construct from an option", async () => {
      const value = 42;
      const error = new Error("An error occurred");
      const option = Option.Some(value);
      const task = Task.fromPredicate(
        () => option,
        () => true,
        () => error
      );
      const result = await task.run();
      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(value);
    });

    it("should be able to narrow the type of the value", async () => {
      const value = 42 as number | string;
      const error = new Error("An error occurred");
      const option = Option.Some(value);
      const task = Task.fromPredicate(
        () => option,
        (x): x is number => typeof x === "number",
        () => error
      );
      const result = await task.run();
      if (result.isOk()) {
        expectTypeOf(result.unwrap()).toEqualTypeOf<number>();
      }
    });
  });

  it("should correctly map a function over Task", async () => {
    const value = 42;
    const f = (x: number) => x * 2;
    const task = Task.from(value);
    const mappedTask = task.map(f);
    const result = await mappedTask.run();
    expect(result.isOk()).toBeTruthy();
    expect(result.unwrap()).toEqual(f(value));
  });

  it("should correctly flatMap a function over Task", async () => {
    const value = 42;
    const f = (x: number) => Task.from(x * 2);
    const task = Task.from(value);
    const flatMappedTask = task.flatMap(f);
    const result = await flatMappedTask.run();
    expect(result.isOk()).toBeTruthy();
    expect(result.unwrap()).toEqual((await f(value)).unwrap());
  });

  it("should correctly recover a Task", async () => {
    const error = new Error("An error occurred");
    const f = (e: Error) => Task.Err(e.message.toUpperCase());
    const task = Task.Err(error);
    const flatMappedErrTask = task.recover(f);
    const result = await flatMappedErrTask.run();
    expect(result.isErr()).toBeTruthy();
    expect(result.unwrapErr()).toEqual((await f(error)).unwrapErr());
  });

  it("should correctly mapErr a function over Task", async () => {
    const error = new Error("An error occurred");
    const f = (e: Error) => new Error(e.message.toUpperCase());
    const task = Task.Err(error);
    const mappedErrTask = task.mapErr(f);
    const result = await mappedErrTask.run();
    expect(result.isErr()).toBeTruthy();
    expect(result.unwrapErr()).toEqual(f(error));
  });

  describe.concurrent("traverse", () => {
    it("should correctly traverse an array of values", async () => {
      const values = [1, 2, 3, 4];
      const f = (x: number) => Task.from(x * 2);
      const expectedResult = values.map((x) => x * 2);

      const traversedTask = Task.traverse(values, f);
      const result = await traversedTask.run();

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(expectedResult);
    });

    it("should correctly traverse a record of values", async () => {
      const values = { a: 1, b: 2, c: 3, d: 4 };
      const f = (x: number) => Task.from(x * 2);
      const expectedResult = { a: 2, b: 4, c: 6, d: 8 };

      const traversedTask = Task.traverse(values, f);
      const result = await traversedTask.run();

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(expectedResult);
    });

    it("should handle errors", async () => {
      const values = [1, 2, 3, 4];
      const error = new Error("An error occurred");
      const f = (x: number) => (x === 3 ? Task.Err(error) : Task.from(x * 2));

      const traversedTask = Task.traverse(values, f);
      const result = await traversedTask.run();

      expect(result.isErr()).toBeTruthy();
    });
  });

  describe.concurrent("traversePar", () => {
    it("should correctly traverse an array of values", async () => {
      const values = [1, 2, 3, 4];
      const f = (x: number) => Task.from(x * 2);
      const expectedResult = values.map((x) => x * 2);

      const traversedTask = Task.traversePar(values, f);
      const result = await traversedTask.run();

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(expectedResult);
    });

    it("should correctly traverse a record of values", async () => {
      const values = { a: 1, b: 2, c: 3, d: 4 };
      const f = (x: number) => Task.from(x * 2);
      const expectedResult = { a: 2, b: 4, c: 6, d: 8 };

      const traversedTask = Task.traversePar(values, f);
      const result = await traversedTask.run();

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(expectedResult);
    });

    it("should handle errors", async () => {
      const values = [1, 2, 3, 4];
      const error = new Error("An error occurred");
      const f = (x: number) => (x === 3 ? Task.Err(error) : Task.from(x * 2));

      const traversedTask = Task.traversePar(values, f);
      const result = await traversedTask.run();

      expect(result.isErr()).toBeTruthy();
    });

    it("should traverse in parallel", async () => {
      const values = [10, 10];
      const toTask = (x: number) => Task.sleep(x).map(() => Date.now());
      const parallelTask = Task.traversePar(values, toTask);
      const result = await parallelTask.run();

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()[0]).toBeLessThanOrEqual(result.unwrap()[1]);
    });

    it("should traverse in parallel with a limit", async () => {
      const values = [10, 10, 10, 10, 10, 10];
      const toTask = (x: number) => Task.sleep(x).map(() => Date.now());
      const parallelTask = Task.traversePar(values, toTask, 2);
      const result = await parallelTask.run();

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()[0]).toBeLessThanOrEqual(result.unwrap()[1]);
      expect(result.unwrap()[2]).toBeLessThanOrEqual(result.unwrap()[3]);
      expect(result.unwrap()[4]).toBeLessThanOrEqual(result.unwrap()[5]);
    });
  });

  describe.concurrent("any", () => {
    it("should correctly return the first Ok result", async () => {
      const tasks = [
        Task.Err<Error>(new Error("An error occurred")),
        Task.Ok<number>(42),
        Task.Err<string>("24"),
      ];
      const result = await Task.any(tasks);
      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(42);
    });

    it("should correctly return the first Err result", async () => {
      const tasks = [
        Task.Err(new Error("An error occurred")),
        Task.Err(new Error("Another error occurred")),
      ];
      const result = await Task.any(tasks);
      expect(result.isErr()).toBeTruthy();
    });

    it("should correctly return first Ok result in a record", async () => {
      const tasks = {
        a: Task.Err<Error>(new Error("An error occurred")),
        b: Task.Ok<number>(42),
        c: Task.Ok<string>("24"),
      };
      const result = await Task.any(tasks);
      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(42);
    });
  });

  describe.concurrent("tryCatch", () => {
    it("should correctly return an Ok result", async () => {
      const value = 42;
      const task = Task.tryCatch(
        () => value,
        (e) => e as Error
      );
      const result = await task.run();
      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(value);
    });

    it("should correctly return an Err result", async () => {
      const error = new Error("An error occurred");
      const task = Task.tryCatch(
        () => {
          throw error;
        },
        (e) => e as Error
      );
      const result = await task.run();
      expect(result.isErr()).toBeTruthy();
      expect(result.unwrapErr()).toEqual(error);
    });
  });

  describe.concurrent("parallel", () => {
    it("should correctly return an array of Ok results", async () => {
      const values = [1, 2, 3, 4];
      const tasks = values.map((x) => Task.from(x * 2));
      const expectedResult = values.map((x) => x * 2);

      const parallelTask = Task.parallel(tasks);
      const result = await parallelTask.run();

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(expectedResult);
    });

    it("should correctly handle a record of Ok results", async () => {
      const values = { a: 1, b: 2, c: 3, d: 4 };
      const tasks = {
        a: Task.from(values.a * 2),
        b: Task.from(values.b * 2),
        c: Task.from(values.c * 2),
        d: Task.from(values.d * 2),
      };
      const expectedResult = {
        a: values.a * 2,
        b: values.b * 2,
        c: values.c * 2,
        d: values.d * 2,
      };

      const parallelTask = Task.parallel(tasks);
      const result = await parallelTask.run();

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(expectedResult);
    });

    it("should handle errors", async () => {
      const values = [1, 2, 3, 4];
      const tasks = values.map((x) =>
        x === 3 ? Task.Err(new Error("An error occurred")) : Task.from(x * 2)
      );

      const parallelTask = Task.parallel(tasks);
      const result = await parallelTask.run();

      expect(result.isErr()).toBeTruthy();
    });

    it("should resolve in parallel", async () => {
      const taskOne = Task.sleep(10).map(() => Date.now());
      const taskTwo = Task.sleep(10).map(() => Date.now());

      const parallelTask = Task.parallel([taskOne, taskTwo]);
      const result = await parallelTask.run();

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()[0]).toBeLessThanOrEqual(result.unwrap()[1]);
    });

    it("should resolve in parallel with a limit", async () => {
      const taskOne = Task.sleep(10).map(() => Date.now());
      const taskTwo = Task.sleep(10).map(() => Date.now());

      const parallelTask = Task.parallel([taskOne, taskTwo], 1);
      const result = await parallelTask.run();

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()[0]).toBeLessThan(result.unwrap()[1]);
    });

    it("should throw an error if the limit is less than 1", () => {
      expect(() => Task.parallel([], 0)).toThrow();
    });
  });

  describe.concurrent("sequential", () => {
    it("should correctly return an array of Ok results", async () => {
      const values = [1, 2, 3, 4];
      const tasks = values.map((x) => Task.from(x * 2));
      const expectedResult = values.map((x) => x * 2);

      const sequentialTask = Task.sequential(tasks);
      const result = await sequentialTask;

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(expectedResult);
    });

    it("should correctly handle a record of Ok results", async () => {
      const values = { a: 1, b: 2, c: 3, d: 4 };
      const tasks = {
        a: Task.from(values.a * 2),
        b: Task.from(values.b * 2),
        c: Task.from(values.c * 2),
        d: Task.from(values.d * 2),
      };
      const expectedResult = {
        a: values.a * 2,
        b: values.b * 2,
        c: values.c * 2,
        d: values.d * 2,
      };

      const parallelTask = Task.sequential(tasks);
      const result = await parallelTask.run();

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(expectedResult);
    });

    it("should return the first error", async () => {
      const values = [1, 2, 3, 4];
      const tasks = values.map((x) =>
        x === 3
          ? Task.Err(new Error("An error occurred: " + x))
          : Task.from(x * 2)
      );

      const sequentialTask = Task.sequential(tasks);
      const result = await sequentialTask;

      expect(result.isErr()).toBeTruthy();
      expect(result.unwrapErr()).toEqual(new Error("An error occurred: 3"));
    });

    it("should resolve sequentially", async () => {
      const taskOne = Task.sleep(10).map(() => Date.now());
      const taskTwo = Task.sleep(10)
        .map(() => Date.now())
        .flatMap(() => Task.sleep(10).map(() => Date.now()));

      const timestamps = await Task.sequential([taskOne, taskTwo]).run();
      const timestampsUnwrapped = timestamps.unwrap();

      expect(timestampsUnwrapped.length).toBe(2);
      expect(
        timestampsUnwrapped[1] - timestampsUnwrapped[0]
      ).toBeGreaterThanOrEqual(20);
    });
  });

  describe.concurrent("coalesce", () => {
    it("should resolve sequentially", async () => {
      const taskOne = Task.sleep(10).map(() => Date.now());
      const taskTwo = Task.sleep(10)
        .map(() => Date.now())
        .flatMap(() => Task.sleep(10).map(() => Date.now()));

      const timestamps = await Task.coalesce([taskOne, taskTwo]).run();
      const timestampsUnwrapped = timestamps.unwrap();

      expect(timestampsUnwrapped.length).toBe(2);
      expect(
        timestampsUnwrapped[1] - timestampsUnwrapped[0]
      ).toBeGreaterThanOrEqual(20);
    });

    it("should accumulate errors", async () => {
      const values = [1, 2, 3, 4];
      const tasks: Task<Error, number>[] = values.map((x) =>
        x > 2 ? Task.Err(new Error("An error occurred")) : Task.from(x * 2)
      );

      const result = await Task.coalesce(tasks);

      expect(result.isErr()).toBeTruthy();
      expect(result.unwrapErr().length).toBe(2);
    });

    it("should accumulate errors when provided a record", async () => {
      const values = { a: 1, b: 2, c: 3, d: 4 };
      const tasks = {
        a: Task.from(values.a * 2),
        b: Task.from(values.b * 2),
        c: Task.Err(new Error("An error occurred")),
        d: Task.Err(new Error("Another error occurred")),
      };

      const result = await Task.coalesce(tasks);

      expect(result.isErr()).toBeTruthy();
      expect(result.unwrapErr()).toEqual({
        c: new Error("An error occurred"),
        d: new Error("Another error occurred"),
      });
    });

    it("should resolve a list of Ok results", async () => {
      const values = [1, 2, 3, 4];
      const tasks = values.map((x) => Task.from(x * 2));
      const expectedResult = values.map((x) => x * 2);

      const result = await Task.coalesce(tasks);

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(expectedResult);
    });

    it("should resolve a record of Ok results", async () => {
      const values = { a: 1, b: 2, c: 3, d: 4 };
      const tasks = {
        a: Task.from(values.a * 2),
        b: Task.from(values.b * 2),
        c: Task.from(values.c * 2),
        d: Task.from(values.d * 2),
      };
      const expectedResult = {
        a: values.a * 2,
        b: values.b * 2,
        c: values.c * 2,
        d: values.d * 2,
      };

      const result = await Task.coalesce(tasks);

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()).toEqual(expectedResult);
    });
  });

  describe.concurrent("coalescePar", () => {
    it("should resolve in parallel", async () => {
      const taskOne = Task.sleep(10).map(() => Date.now());
      const taskTwo = Task.sleep(10).map(() => Date.now());

      const parallelTask = Task.coalescePar([taskOne, taskTwo]);
      const result = await parallelTask.run();

      expect(result.isOk()).toBeTruthy();
      expect(result.unwrap()[0]).toBeLessThanOrEqual(result.unwrap()[1]);
    });

    it("should accumulate errors", async () => {
      const values = [1, 2, 3, 4];
      const tasks: Task<string, number>[] = values.map((x) =>
        x < 3 ? Task.Err("An error occurred") : Task.from(x * 2)
      );

      const result = await Task.coalescePar(tasks);

      expect(result.isErr()).toBeTruthy();
      expect(result.unwrapErr()).toEqual([
        "An error occurred",
        "An error occurred",
      ]);
    });

    it("should accumulate errors when provided a record", async () => {
      const values = { a: 1, b: 2, c: 3, d: 4 };
      const tasks = {
        a: Task.from(values.a * 2),
        b: Task.from(values.b * 2),
        c: Task.Err("An error occurred"),
        d: Task.Err("Another error occurred"),
      };

      const result = await Task.coalescePar(tasks);

      expect(result.isErr()).toBeTruthy();
      expect(result.unwrapErr()).toEqual({
        c: "An error occurred",
        d: "Another error occurred",
      });
    });

    it("should throw an error if the limit is less than 1", () => {
      expect(() => Task.coalescePar([], 0)).toThrow();
    });
  });
  describe.concurrent("race", () => {
    it("should correctly return the first settled result", async () => {
      const taskOne = Task.sleep(10).map(() => 10);
      const taskTwo = Task.sleep(20).map(() => 20);
      const taskThree = Task.sleep(30).flatMap(() => Task.Err(new Error()));

      const tasks = [taskOne, taskTwo, taskThree];

      const first = await Task.race(tasks).run();
      expect(first.isOk()).toBeTruthy();
      expect(first.unwrap()).toBe(10);
    });

    it("should correctly return the first settled result when provided a record", async () => {
      const taskOne = Task.sleep(10).map(() => 10);
      const taskTwo = Task.sleep(20).map(() => 20);
      const taskThree = Task.sleep(30).flatMap(() => Task.Err(new Error()));

      const first = await Task.race({
        a: taskOne,
        b: taskTwo,
        c: taskThree,
      }).run();
      expect(first.isOk()).toBeTruthy();
      expect(first.unwrap()).toBe(10);
    });
  });

  describe.concurrent("settle", () => {
    it("should settle a list of tasks", async () => {
      const values = [1, 2, 3, 4];
      const tasks = values.map((x) =>
        x > 2 ? Task.Err("oops") : Task.from(x * 2)
      );

      const result = await Task.settle(tasks);

      expect(result).toEqual([
        { type: "Ok", value: 2 },
        { type: "Ok", value: 4 },
        { type: "Err", error: "oops" },
        { type: "Err", error: "oops" },
      ]);
    });

    it("should settle a record of tasks", async () => {
      const values = { a: 1, b: 2, c: 3, d: 4 };
      const tasks = {
        a: Task.from(values.a * 2),
        b: Task.from(values.b * 2),
        c: Task.Err("oops"),
        d: Task.Err("oops"),
      };

      const result = await Task.settle(tasks);

      expect(result).toEqual({
        a: { type: "Ok", value: 2 },
        b: { type: "Ok", value: 4 },
        c: { type: "Err", error: "oops" },
        d: { type: "Err", error: "oops" },
      });
    });
  });

  describe.concurrent("settlePar", () => {
    it("should settle a list of tasks in parallel", async () => {
      const values = [1, 2, 3, 4];
      const tasks = values.map((x) =>
        x > 2 ? Task.Err("oops") : Task.from(x * 2)
      );

      const result = await Task.settlePar(tasks);

      expect(result).toEqual([
        { type: "Ok", value: 2 },
        { type: "Ok", value: 4 },
        { type: "Err", error: "oops" },
        { type: "Err", error: "oops" },
      ]);
    });

    it("should settle a record of tasks in parallel", async () => {
      const values = { a: 1, b: 2, c: 3, d: 4 };
      const tasks = {
        a: Task.from(values.a * 2),
        b: Task.from(values.b * 2),
        c: Task.Err("oops"),
        d: Task.Err("oops"),
      };

      const result = await Task.settlePar(tasks);

      expect(result).toEqual({
        a: { type: "Ok", value: 2 },
        b: { type: "Ok", value: 4 },
        c: { type: "Err", error: "oops" },
        d: { type: "Err", error: "oops" },
      });
    });

    it("should resolve in parallel", async () => {
      const values = [1, 2, 3, 4];
      const tasks = values.map((x) => Task.from(x * 2));

      const start = Date.now();
      await Task.settlePar(tasks);
      const end = Date.now();

      expect(end - start).toBeLessThan(10);
    });
  });

  describe.concurrent("match", () => {
    it("should correctly match on Ok", async () => {
      const task = Task.Ok<number>(1);
      const result = await task.match({
        Ok: (value) => value,
        Err: (error) => 0,
      });
      expect(result).toBe(1);
    });

    it("should correctly match on Err", async () => {
      const task = Task.Err(new Error("An error occurred"));
      const result = await task.match({
        Ok: (value) => value,
        Err: (error) => error,
      });
      expect(result).toEqual(new Error("An error occurred"));
    });
  });

  describe.concurrent("tap", () => {
    it("should correctly tap on Ok", async () => {
      const task = Task.from(1);
      const fn = vi.fn();
      await task.tap(fn);
      expect(fn).toBeCalledWith(1);
    });

    it("should not call on Err", async () => {
      const task = Task.tryCatch(
        () => {
          throw new Error("An error occurred");
        },
        (error) => error
      );
      const fn = vi.fn();
      await task.tap(fn);
      expect(fn).not.toBeCalled();
    });
  });

  describe.concurrent("tapErr", () => {
    it("should correctly tap on Err", async () => {
      const task = Task.tryCatch(
        () => {
          throw new Error("An error occurred");
        },
        (error) => error
      );
      const fn = vi.fn();
      const map = vi.fn();
      const tap = vi.fn();
      await task.tapErr(fn).tapErr(fn).tap(tap).map(map);
      expect(fn).toBeCalledWith(new Error("An error occurred"));
      expect(tap).not.toBeCalled();
      expect(map).not.toBeCalled();
    });

    it("should not call on Ok", async () => {
      const task = Task.from(1);
      const fn = vi.fn();
      await task.tapErr(fn);
      expect(fn).not.toBeCalled();
    });
  });

  describe.concurrent("schedule", () => {
    it("should retry a task", async () => {
      const fn = vi.fn();
      const task = Task.tryCatch(
        () => {
          fn();
          throw new Error("An error occurred");
        },
        (error) => error as Error
      );
      const res = await task.schedule({
        retry: 3,
      });
      expect(fn).toBeCalledTimes(3);
      expect(res).toEqual(Result.Err(new Error("An error occurred")));
    });

    it("should not retry a successful task", async () => {
      const fn = vi.fn();
      const task = Task.from(() => {
        fn();
        return 1;
      });
      const res = await task.schedule({
        retry: 3,
      });
      expect(fn).toBeCalledTimes(1);
      expect(res).toEqual(Result.Ok(1));
    });

    it("should allow a custom retry strategy", async () => {
      const fn = vi.fn();
      const task = Task.tryCatch(
        () => {
          fn();
          throw new Error("An error occurred");
        },
        (error) => error as Error
      );
      const res = await task.schedule({
        retry: () => 3,
      });
      expect(fn).toBeCalledTimes(3);
      expect(res).toEqual(Result.Err(new Error("An error occurred")));
    });

    it("should allow for the custom retry strategy to return a boolean", async () => {
      const fn = vi.fn();
      const task = Task.tryCatch(
        () => {
          fn();
          throw new Error("An error occurred");
        },
        (error) => error as Error
      );
      let times = 0;
      const res = await task.schedule({
        retry: () => {
          times++;
          return times < 3;
        },
      });
      expect(fn).toBeCalledTimes(3);
      expect(res).toEqual(Result.Err(new Error("An error occurred")));
    });

    it("should allow for the custom retry strategy to return a promise of boolean or number", async () => {
      const fn = vi.fn();
      const task = Task.tryCatch(
        () => {
          fn();
          throw new Error("An error occurred");
        },
        (error) => error as Error
      );
      let times = 0;
      const res = await task.schedule({
        retry: async () => {
          times++;
          return times < 3 ? true : false;
        },
      });
      expect(fn).toBeCalledTimes(3);
      expect(res).toEqual(Result.Err(new Error("An error occurred")));
    });

    it("should timeout a slow task", async () => {
      const fn = vi.fn();
      const task = Task.from(fn).flatMap(() => Task.sleep(20));
      const res = await task.schedule({
        timeout: 10,
      });
      expect(fn).toBeCalledTimes(1);
      expect(res).toEqual(Result.Err(new TaskTimeoutError()));
    });

    it("should not timeout a task when the task is succeeds before timeout", async () => {
      const fn = vi.fn();
      const now = Date.now();
      const task = Task.from(() => {
        fn();
        return Date.now();
      });
      const res = await task.schedule({
        timeout: 10,
      });
      expect(fn).toBeCalledTimes(1);
      const value = res.unwrap();
      expect(value).toBeGreaterThanOrEqual(now);
    });

    it("should delay a task", async () => {
      const fn = vi.fn();
      const now = Date.now();
      const task = Task.from(() => {
        fn();
        return Date.now();
      });
      const res = await task.schedule({
        delay: 11,
      });
      expect(fn).toBeCalledTimes(1);
      const value = res.unwrap();
      expect(value).toBeGreaterThanOrEqual(now + 10);
    });

    it("should delay a task with a custom delay", async () => {
      const fn = vi.fn();
      const now = Date.now();
      const task = Task.from(() => {
        fn();
        return Date.now();
      });
      const res = await task.schedule({ delay: () => 11 });
      expect(fn).toBeCalledTimes(1);
      const value = res.unwrap();
      expect(value).toBeGreaterThanOrEqual(now + 10);
    });

    it("should delay a task with a custom delay that returns a promise", async () => {
      const fn = vi.fn();
      const now = Date.now();
      const task = Task.from(() => {
        fn();
        return Date.now();
      });
      const res = await task.schedule({ delay: async () => 11 });
      expect(fn).toBeCalledTimes(1);
      const value = res.unwrap();
      expect(value).toBeGreaterThanOrEqual(now + 10);
    });

    it("should allow for an exponential backoff by combining retry and delay", async () => {
      const fn = vi.fn();
      const task = Task.tryCatch(
        () => {
          fn();
          throw new Error("An error occurred");
        },
        (error) => error as Error
      );
      const delays: number[] = [];
      const res = await task.schedule({
        delay: (i) => {
          const delay = 5 * i;
          delays.push(delay);
          return delay;
        },
        retry: 3,
      });
      expect(fn).toBeCalledTimes(3);
      expect(delays).toEqual([0, 5, 10]);
      expect(res).toEqual(Result.Err(new Error("An error occurred")));
    });

    it("should repeat a task", async () => {
      const fn = vi.fn();
      const task = Task.from(() => {
        fn();
        return 1;
      });
      const res = await task.schedule({
        repeat: 3,
      });
      expect(fn).toBeCalledTimes(4);
      expect(res).toEqual(Result.Ok(1));
    });

    it("should not repeat a task if the task fails", async () => {
      const fn = vi.fn();
      const task = Task.tryCatch(
        () => {
          fn();
          throw new Error("An error occurred");
        },
        (error) => error as Error
      );
      const res = await task.schedule({
        repeat: 3,
      });
      expect(fn).toBeCalledTimes(1);
      expect(res).toEqual(Result.Err(new Error("An error occurred")));
    });

    it("should allow for a custom repeat strategy", async () => {
      const fn = vi.fn();
      const task = Task.from(() => {
        fn();
        return 1;
      });
      const res = await task.schedule({
        repeat: (invocations, val) => val,
      });
      expect(fn).toBeCalledTimes(2);
      expect(res).toEqual(Result.Ok(1));
    });

    it("should allow for a custom repeat strategy that returns a promise", async () => {
      const fn = vi.fn();
      const task = Task.from(() => {
        fn();
        return 1;
      });
      const res = await task.schedule({
        repeat: async (invocations, val) => val,
      });
      expect(fn).toBeCalledTimes(2);
      expect(res).toEqual(Result.Ok(1));
    });

    it("should allow for a custom retry strategy that returns a boolean", async () => {
      const fn = vi.fn();
      let errors = 0;
      const task = Task.tryCatch(
        () => {
          fn();
          if (errors++ < 2) {
            throw new Error("An error occurred");
          }
          return 1;
        },
        (error) => error as Error
      );
      const res = await task.schedule({
        retry: (i) => i < 3,
      });
      expect(fn).toBeCalledTimes(3);
      expect(res).toEqual(Result.Ok(1));
    });

    it("should allow for a custom retry strategy that returns a promise of boolean", async () => {
      const fn = vi.fn();
      let errors = 0;
      const task = Task.tryCatch(
        () => {
          fn();
          if (errors++ < 2) {
            throw new Error("An error occurred");
          }
          return 1;
        },
        (error) => error as Error
      );
      const res = await task.schedule({
        retry: async (i) => i < 3,
      });
      expect(fn).toBeCalledTimes(3);
      expect(res).toEqual(Result.Ok(1));
    });

    it("should allow for a mix of strategies", async () => {
      const fn = vi.fn();
      let errors = 0;
      const task = Task.tryCatch(
        () => {
          fn();
          if (errors++ < 2) {
            throw new Error("An error occurred");
          }
          return 1;
        },
        (error) => error as Error
      );
      const delays: number[][] = [];
      const repeatInvocations: number[] = [];
      const retryInvocations: number[] = [];

      const res = await task.schedule({
        timeout: 10,
        delay: (retries, repeats) => {
          delays.push([retries, repeats]);
          return 5;
        },
        repeat: (i) => {
          repeatInvocations.push(i);
          return 3;
        },
        retry: (i) => {
          retryInvocations.push(i);
          return 3;
        },
      });
      expect(fn).toBeCalledTimes(6);
      expect(delays).toEqual([
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ]);
      expect(repeatInvocations).toEqual([0, 1, 2, 3]);
      expect(retryInvocations).toEqual([0, 1]);
      expect(res).toEqual(Result.Ok(1));
    });

    it("should handle any errors thrown by the strategies", async () => {
      const task = Task.Ok(1);
      const res1 = await Task.Err(1).schedule({
        retry: () => {
          throw new Error("An error occurred");
          return 1;
        },
      });
      const res2 = await task.schedule({
        repeat: () => {
          throw new Error("An error occurred");
          return 1;
        },
      });
      const res3 = await task.schedule({
        delay: () => {
          throw new Error("An error occurred");
          return 1;
        },
      });
      expect(res1).toEqual(Result.Err(new TaskSchedulingError()));
      expect(res2).toEqual(Result.Err(new TaskSchedulingError()));
      expect(res3).toEqual(Result.Err(new TaskSchedulingError()));
    });

    it("should handle any errors returned by the strategies", async () => {
      const task = Task.Ok(1);
      const res1 = await Task.Err(1).schedule({
        retry: () => {
          return Task.Err(1);
        },
      });
      const res2 = await task.schedule({
        repeat: () => {
          return Task.Err(1);
        },
      });
      const res3 = await task.schedule({
        delay: () => {
          return Task.Err(1);
        },
      });
      expect(res1).toEqual(Result.Err(new TaskSchedulingError()));
      expect(res2).toEqual(Result.Err(new TaskSchedulingError()));
      expect(res3).toEqual(Result.Err(new TaskSchedulingError()));
    });
  });

  describe("unwrap", () => {
    it("should unwrap a Ok task", async () => {
      const task = Task.Ok(1);
      const res = await task.unwrap();
      expect(res).toEqual(1);
    });

    it("should throw an error if the task is an Err", async () => {
      const task = Task.Err(1);
      await expect(task.unwrap()).rejects.toThrowError();
    });
  });

  describe("unwrapOr", () => {
    it("should unwrap a Ok task", async () => {
      const task = Task.Ok(1);
      const res = await task.unwrapOr(2);
      expect(res).toEqual(1);
    });

    it("should return the default value if the task is an Err", async () => {
      const task = Task.Err(1);
      const res = await task.unwrapOr(2);
      expect(res).toEqual(2);
    });

    it("should accept a function as the default value", async () => {
      const task = Task.Err(1);
      const res = await task.unwrapOr(() => 2);
      expect(res).toEqual(2);
    });
  });

  describe("unwrapErr", () => {
    it("should unwrap a Err task", async () => {
      const task = Task.Err(1);
      const res = await task.unwrapErr();
      expect(res).toEqual(1);
    });

    it("should throw an error if the task is an Ok", async () => {
      const task = Task.Ok(1);
      await expect(task.unwrapErr()).rejects.toThrowError();
    });
  });
});

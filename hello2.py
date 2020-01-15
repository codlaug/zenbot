
import sys
import ta
import pandas as pd
from sklearn.preprocessing import minmax_scale, MinMaxScaler
import numpy as np
import tensorflow as tf

model = tf.keras.models.load_model('predict.h5')

TIME_STEPS = 28

def trim_dataset(mat, batch_size):
    """
    trims dataset to a size that's divisible by BATCH_SIZE
    """
    no_of_rows_drop = mat.shape[0] % batch_size
    if no_of_rows_drop > 0:
        return mat[:-no_of_rows_drop]
    else:
        return mat

def build_timeseries(mat):
    """
    Converts ndarray into timeseries format and supervised data format. Takes first TIME_STEPS
    number of rows as input and sets the TIME_STEPS+1th data as corresponding output and so on.
    :param mat: ndarray which holds the dataset
    :param y_col_index: index of column which acts as output
    :return: returns two ndarrays-- input and output in format suitable to feed
    to LSTM.
    """
    # total number of time-series samples would be len(mat) - TIME_STEPS
    dim_0 = mat.shape[0] - TIME_STEPS
    # print('dim0', dim_0)
    dim_1 = mat.shape[1]
    x = np.zeros((dim_0, TIME_STEPS, dim_1))
    # y = np.zeros((dim_0,))
    # print("dim_0",dim_0)
    for i in range(dim_0):
        x[i] = mat[i:TIME_STEPS+i]
        # y[i] = mat[TIME_STEPS+i, y_col_index]
#         if i < 10:
#           print(i,"-->", x[i,-1,:], y[i])
    # print("length of time-series i/o",x.shape,y.shape)
    return x


while True:

    args = input()
    arg_array = args.split(' ')

    timestamps = [ int(n) for n in arg_array[0].split(',') ]
    opens = [ float(n) for n in arg_array[1].split(',') ]
    high = [ float(n) for n in arg_array[2].split(',') ]
    low = [ float(n) for n in arg_array[3].split(',') ]
    close = [ float(n) for n in arg_array[4].split(',') ]
    volume = [ float(n) for n in arg_array[5].split(',') ]



    df = pd.DataFrame({'Timestamp': timestamps, 'Open': opens, 'High': high, 'Low': low, 'Close': close, 'Volume': volume}).set_index('Timestamp')


    ta.add_all_ta_features(df, open="Open", high="High", low="Low", close="Close", volume="Volume")


    columns = df.columns.values.tolist()
    # print(columns)


    signals = np.nan_to_num(df.loc[:, columns].to_numpy())
    # print(len(signals))


    min_max_scaler = MinMaxScaler()
    signal_features = min_max_scaler.fit_transform(signals)

    # print(len(signal_features))

    state = signal_features

    feed = build_timeseries(state)

    # print(feed)

    # print(trim_dataset(feed, 20))
    pred = model.predict(trim_dataset(feed, 20), batch_size=20)
    pred = (pred * min_max_scaler.data_range_[3]) + min_max_scaler.data_min_[3]

    print('{d:04.8f}'.format(d=pred[0][-1])) #output

    # for c,v in zip(columns, df.iloc[-1,:]):
    #     print(c, v)
    sys.stdout.flush()
# end while loop
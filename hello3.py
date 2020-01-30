
import sys
import ta
import pandas as pd
from sklearn.preprocessing import MaxAbsScaler
import numpy as np
import tensorflow as tf
from sklearn.externals import joblib
from PyEMD import EEMD

short_model = tf.keras.models.load_model('predict-trend/trend3both0-2.h5')
both_model = tf.keras.models.load_model('predict-trend/trend8both0-2.h5')
long_model = tf.keras.models.load_model('predict-trend/trend18both0-2.h5')
vlong_model = tf.keras.models.load_model('predict-trend/trend38both0-2.h5')
long3_model = tf.keras.models.load_model('predict-trend/trend18both05-3.h5')

eemd = EEMD()

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


max_abs_scaler = joblib.load('predict-trend/scaler.save') 


# f = open("observations.txt","w")

while True:

    try:
        args = input()
    except EOFError:
        exit()
    
    arg_array = args.split(' ')

    timestamps = [ int(n) for n in arg_array[0].split(',') ]
    opens = [ float(n) for n in arg_array[1].split(',') ]
    high = [ float(n) for n in arg_array[2].split(',') ]
    low = [ float(n) for n in arg_array[3].split(',') ]
    close = [ float(n) for n in arg_array[4].split(',') ]
    volume = [ float(n) for n in arg_array[5].split(',') ]


    df = pd.DataFrame({'Timestamp': timestamps, 'Open': opens, 'High': high, 'Low': low, 'Close': close, 'Volume': volume}).set_index('Timestamp')


    # df.to_csv('observations1-'+str(df.iloc[0].name)+'.csv')


    ta.add_all_ta_features(df, open="Open", high="High", low="Low", close="Close", volume="Volume")


    # df.to_csv('observations2-'+str(df.iloc[0].name)+'.csv')
    

    # t = np.linspace(0, 1, len(close))
    # IMF = eemd.emd(np.array(close), t)
    # imf_value = IMF[-1][-1]
    # del IMF

    # close_series = pd.Series(close)

    ema = ta.utils.ema(pd.DataFrame(close), 26)
    ema_value = ema.iat[-1, 0]
    # print(close_df, file=sys.stderr)

    # macd = ta.trend.macd(close_series)
    # macd_value = macd.iat[-1]

    # rsi_value = ta.momentum.rsi(close_series).iat[-1]



    df = df.tail(48)



    columns = df.columns.values.tolist()
    # print(columns)


    signals = np.nan_to_num(df.loc[:, columns])
    # print(len(signals))


    state = max_abs_scaler.transform(signals)

    # print(len(signal_features))

    # f.write(str(timestamps[-1])+' '+np.array_str(state, precision=5, max_line_width=1200)+'\n')


    feed = build_timeseries(state)

    # print(feed)
    data_feed = trim_dataset(feed, 20)
    # print(trim_dataset(feed, 20))
    short = short_model.predict(data_feed, batch_size=20)
    # stop = stop_model.predict(trim_dataset(feed, 20), batch_size=20)
    # mid = mid_model.predict(trim_dataset(feed, 20), batch_size=20)
    # up = up_model.predict(trim_dataset(feed, 20), batch_size=20)
    # down = down_model.predict(trim_dataset(feed, 20), batch_size=20)
    mid = both_model.predict(data_feed, batch_size=20)
    # big = big_model.predict(trim_dataset(feed, 20), batch_size=20)
    lng = long_model.predict(trim_dataset(feed, 20), batch_size=20)
    vlong = vlong_model.predict(trim_dataset(feed, 20), batch_size=20)
    # moon = moon_model.predict(trim_dataset(feed, 20), batch_size=20)
    long3 = long3_model.predict(trim_dataset(feed, 20), batch_size=20)

    # short = short[-1]
    # mid = mid[-1]
    # lng = lng[-1]
    pred = [item for sublist in [short[-1], mid[-1], lng[-1], vlong[-1], [ema_value], long3[-1][0:2]] for item in sublist]
    
    print('{d[0]:04.4f} {d[1]:04.4f} {d[2]:04.4f} {d[3]:04.4f} {d[4]:04.4f} {d[5]:04.4f} {d[6]:04.4f} {d[7]:04.4f} {d[8]:04.4f} {d[9]:04.4f} {d[10]:04.4f}'.format(d=pred)) #output

    # for c,v in zip(columns, df.iloc[-1,:]):
    #     print(c, v)
    sys.stdout.flush()
# end while loop